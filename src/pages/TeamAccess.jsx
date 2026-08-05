// src/pages/TeamAccess.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getValidAccessCode } from '../lib/accessCodes';
import { getEvent, getFridgesForEvent, getSessionsForFridge, getSessionsForFridgeOnDate } from '../lib/db';
import { formatDateTime } from '../lib/units';

export default function TeamAccess() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | invalid | valid
  const [event, setEvent] = useState(null);
  const [fridges, setFridges] = useState([]);
  const [sessionCounts, setSessionCounts] = useState({});

  useEffect(() => {
    validate();
  }, [code]);

  async function startCounting(fridgeId, type) {
    const today = new Date().toISOString().slice(0, 10);
    const todaysSessions = await getSessionsForFridgeOnDate(fridgeId, today);
    const existing = todaysSessions.find((s) => s.label === type);
    if (existing) {
      navigate(`/team/${code}/correct/${existing.id}/choose`);
    } else {
      navigate(`/team/${code}/count/${fridgeId}?type=${type}&teamCode=${code}`);
    }
  }

  async function validate() {
    const result = await getValidAccessCode(code);
    if (!result) {
      setState('invalid');
      return;
    }
    const ev = await getEvent(result.eventId);
    setEvent(ev);
    const fr = await getFridgesForEvent(result.eventId);
    setFridges(fr);
    const counts = {};
    for (const f of fr) {
      counts[f.id] = await getSessionsForFridge(f.id);
    }
    setSessionCounts(counts);
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

  return (
    <div className="page">
      <h1>{event.name}</h1>
      <p className="muted">Teamzugang — Kühlgeräte zählen</p>
      <div className="card">
        <h2>Kühlgeräte</h2>
        <ul className="fridge-list">
          {fridges.map((f) => {
            const sessions = sessionCounts[f.id] || [];
            const last = sessions[sessions.length - 1];
            return (
              <li key={f.id} className="fridge-item">
                <div className="fridge-header">
                  <strong>{f.label} — {f.type}</strong>
                </div>
                <p className="muted">
                  {sessions.length === 0
                    ? 'Noch nicht gezählt'
                    : `Letzte Zählung: ${last.label} — ${formatDateTime(last.timestamp)}`}
                </p>
                <button
                  className="btn-primary"
                  onClick={() => startCounting(f.id, 'Anfangsstand')}
                >
                  Anfangsstand zählen
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => startCounting(f.id, 'Endstand')}
                >
                  Endstand zählen
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
