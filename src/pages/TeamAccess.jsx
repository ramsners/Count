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

const NAME_KEY = 'festwerk-user-name';

export default function TeamAccess() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | invalid | valid | name-entry
  const [event, setEvent] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [validUntil, setValidUntil] = useState(null);
  const [fridges, setFridges] = useState([]);
  const [todayStatus, setTodayStatus] = useState({}); // {fridgeId: {hasAnfang, hasEnd}}
  const [fridgeLocks, setFridgeLocks] = useState({}); // {fridgeId: lockInfo|null}
  const [userName, setUserName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [nameInput, setNameInput] = useState('');

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

      setValidUntil(result.validUntil);
      const ev = await getEvent(result.eventId);
      setEvent(ev);
      setEventId(result.eventId);
      const fr = await getFridgesForEvent(result.eventId);
      setFridges(fr);
      await refreshStatusAndLocks(fr);
      // Name abfragen wenn noch keiner gespeichert
      const savedName = localStorage.getItem(NAME_KEY);
      setState(savedName ? 'valid' : 'name-entry');
    } catch {
      setState('invalid');
    }
  }

  function saveName() {
    const n = nameInput.trim();
    if (!n) return;
    localStorage.setItem(NAME_KEY, n);
    setUserName(n);
    setState('valid');
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

  if (state === 'name-entry') {
    return (
      <div className="page">
        <h1>{event?.name}</h1>
        <div className="card">
          <h2>Wie heißt du?</h2>
          <p className="muted">Dein Name erscheint wenn du eine Zählung sperrst, damit andere wissen wer gerade zählt.</p>
          <input
            className="input"
            placeholder="Dein Name, z.B. Anna"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            autoFocus
          />
          <button className="btn-primary" onClick={saveName} disabled={!nameInput.trim()}>
            Los geht's →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{event.name}</h1>
      <p className="muted">
        Teamzugang — gültig bis {validUntil ? new Date(validUntil).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' : '–'}
      </p>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Eingeloggt als: <strong>{userName}</strong>
        <button className="btn-link" style={{ marginLeft: 8, fontSize: '0.8rem' }} onClick={() => { setNameInput(userName); setState('name-entry'); }}>
          ändern
        </button>
      </p>
      <div className="card">
        <h2>Kühlgeräte</h2>
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>A = Anfangsstand gezählt &nbsp;·&nbsp; E = Endstand gezählt</p>
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
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        className={status.hasEnd ? 'btn-secondary' : 'btn-primary'}
                        style={{ width: '100%' }}
                        disabled={!status.hasAnfang}
                        onClick={() => startCounting(f.id, 'Endstand')}
                      >
                        {status.hasEnd ? '✓ Endstand' : '🌙 Endstand'}
                      </button>
                      {!status.hasAnfang && (
                        <small className="muted" style={{ textAlign: 'center', fontSize: '0.72rem' }}>Zuerst Anfangsstand zählen</small>
                      )}
                    </div>
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
