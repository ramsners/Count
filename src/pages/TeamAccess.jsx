// src/pages/TeamAccess.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getValidAccessCode } from '../lib/accessCodes';
import { getEvent, getFridgesForEvent, getSessionsForFridgeOnDate } from '../lib/db';
import { getFridgeLock, subscribeFridgeLocks } from '../lib/locks';

function localDateStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TeamAccess() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | invalid | valid
  const [event, setEvent] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [fridges, setFridges] = useState([]);
  const [todayStatus, setTodayStatus] = useState({}); // {fridgeId: {hasAnfang, hasEnd}}
  const [fridgeLocks, setFridgeLocks] = useState({}); // {fridgeId: lockInfo|null}

  useEffect(() => {
    validate();
  }, [code]);

  // Realtime-Lock-Updates sobald eventId bekannt
  useEffect(() => {
    if (!eventId) return;
    const unsub = subscribeFridgeLocks(eventId, refreshLocks);
    return unsub;
  }, [eventId]);

  async function refreshStatusAndLocks(fr) {
    const today = localDateStr(Date.now());
    const statusMap = {};
    const lockMap = {};
    await Promise.all(fr.map(async (f) => {
      const sessions = await getSessionsForFridgeOnDate(f.id, today);
      statusMap[f.id] = {
        hasAnfang: sessions.some((s) => s.label === 'Anfangsstand'),
        hasEnd: sessions.some((s) => s.label === 'Endstand'),
      };
      lockMap[f.id] = await getFridgeLock(f.id);
    }));
    setTodayStatus(statusMap);
    setFridgeLocks(lockMap);
  }

  async function refreshLocks() {
    // Nur Lock-Status aktualisieren (für Realtime-Callback)
    setFridges((currentFridges) => {
      Promise.all(currentFridges.map((f) => getFridgeLock(f.id))).then((locks) => {
        const lockMap = {};
        currentFridges.forEach((f, i) => { lockMap[f.id] = locks[i]; });
        setFridgeLocks(lockMap);
      });
      return currentFridges;
    });
  }

  async function startCounting(fridgeId, type) {
    const today = localDateStr(Date.now());
    const todaySessions = await getSessionsForFridgeOnDate(fridgeId, today);
    const existing = todaySessions.find((s) => s.label === type);
    if (existing) {
      navigate(`/team/${code}/correct/${existing.id}/choose`);
    } else {
      navigate(`/team/${code}/count/${fridgeId}?type=${type}&teamCode=${code}`);
    }
  }

  async function validate() {
    try {
      const result = await getValidAccessCode(code);
      if (!result) { setState('invalid'); return; }

      const ev = await getEvent(result.eventId);
      setEvent(ev);
      setEventId(result.eventId);
      const fr = await getFridgesForEvent(result.eventId);
      setFridges(fr);
      await refreshStatusAndLocks(fr);
      setState('valid');
    } catch {
      setState('invalid');
    }
  }

  if (state === 'loading') return <div className="page">Code wird geprüft...</div>;

  if (state === 'invalid') {
    return (
      <div className="page">
        <div className="card">
          <h2>Ungültiger oder abgelaufener Code</h2>
          <p className="muted">Bitte einen neuen QR-Code vom Veranstaltungsleiter holen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{event.name}</h1>
      <p className="muted">Teamzugang — Heute zählen</p>
      <div className="card">
        <h2>Kühlgeräte</h2>
        <ul className="fridge-list">
          {fridges.map((f) => {
            const status = todayStatus[f.id] || {};
            const lock = fridgeLocks[f.id];
            const isLockedByOther = lock && !lock.isOwnLock;

            return (
              <li key={f.id} className="fridge-item">
                <div className="fridge-header">
                  <strong>{f.label} — {f.type}</strong>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {status.hasAnfang && <span className="status-chip green">A</span>}
                    {status.hasEnd && <span className="status-chip blue">E</span>}
                  </div>
                </div>

                {isLockedByOther ? (
                  <div className="lock-badge" style={{ marginTop: '0.5rem' }}>
                    Wird gerade gezählt von: {lock.lockedByName}
                  </div>
                ) : (
                  <div className="row" style={{ marginTop: '0.5rem' }}>
                    <button
                      className={status.hasAnfang ? 'btn-secondary' : 'btn-primary'}
                      style={{ flex: 1 }}
                      onClick={() => startCounting(f.id, 'Anfangsstand')}
                    >
                      {status.hasAnfang ? '✓ Anfangsstand' : '☀ Anfangsstand'}
                    </button>
                    <button
                      className={status.hasEnd ? 'btn-secondary' : 'btn-primary'}
                      style={{ flex: 1 }}
                      disabled={!status.hasAnfang}
                      onClick={() => startCounting(f.id, 'Endstand')}
                    >
                      {status.hasEnd ? '✓ Endstand' : '🌙 Endstand'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
