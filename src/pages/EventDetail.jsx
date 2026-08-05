import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getEvent,
  getFridgesForEvent,
  addFridge,
  deleteFridge,
  getSessionsForFridge,
} from '../lib/db';
import { formatDateTime } from '../lib/units';

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [fridges, setFridges] = useState([]);
  const [sessionCounts, setSessionCounts] = useState({});

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    const ev = await getEvent(Number(eventId));
    setEvent(ev);
    const fr = await getFridgesForEvent(Number(eventId));
    setFridges(fr);
    const counts = {};
    for (const f of fr) {
      const sessions = await getSessionsForFridge(f.id);
      counts[f.id] = sessions;
    }
    setSessionCounts(counts);
  }

  async function createFridge(type) {
    await addFridge({ eventId: Number(eventId), type });
    load();
  }

  async function removeFridge(id) {
    if (confirm('Kühlgerät inkl. aller Zählungen löschen?')) {
      await deleteFridge(id);
      load();
    }
  }

  if (!event) return <div className="page">Lädt...</div>;

  return (
    <div className="page">
      <Link to="/events" className="back-link">
        ← Alle Veranstaltungen
      </Link>
      <h1>{event.name}</h1>
      <p className="muted">
        {event.dateStart}
        {event.dateEnd && event.dateEnd !== event.dateStart ? ` bis ${event.dateEnd}` : ''} —{' '}
        {event.productIds.length} Produkte
      </p>

      <div className="card">
        <h2>Kühlgeräte</h2>
        <div className="row">
          <button className="btn-secondary" onClick={() => createFridge('Kühlschrank')}>
            + Kühlschrank
          </button>
          <button className="btn-secondary" onClick={() => createFridge('Kühltruhe')}>
            + Kühltruhe
          </button>
        </div>

        <ul className="fridge-list">
          {fridges.map((f) => {
            const sessions = sessionCounts[f.id] || [];
            const last = sessions[sessions.length - 1];
            return (
              <li key={f.id} className="fridge-item">
                <div className="fridge-header">
                  <strong>
                    {f.label} — {f.type}
                  </strong>
                  <button className="btn-link danger" onClick={() => removeFridge(f.id)}>
                    Löschen
                  </button>
                </div>
                <p className="muted">
                  {sessions.length === 0
                    ? 'Noch nicht gezählt'
                    : `Letzte Zählung: ${last.label} — ${formatDateTime(last.timestamp)}`}
                </p>
                <button
                  className="btn-primary"
                  onClick={() => navigate(`/count/${f.id}`)}
                >
                  Neue Zählung starten
                </button>
                {sessions.length > 0 && (
                  <button
                    className="btn-secondary"
                    onClick={() => navigate(`/summary/${sessions[sessions.length - 1].id}`)}
                  >
                    Letzten Zettel ansehen
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
