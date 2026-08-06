import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getEvent,
  getFridgesForEvent,
  getSessionsForEventOnDate,
} from '../lib/db';
import { formatDateTime, generateDateRange } from '../lib/units';

function localDateStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DaySummary() {
  const { eventId, dateStr } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [fridges, setFridges] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [allDates, setAllDates] = useState([]);

  useEffect(() => {
    load();
  }, [eventId, dateStr]);

  async function load() {
    const [ev, fr, sess] = await Promise.all([
      getEvent(Number(eventId)),
      getFridgesForEvent(Number(eventId)),
      getSessionsForEventOnDate(Number(eventId), dateStr),
    ]);
    setEvent(ev);
    setFridges(fr);
    setSessions(sess);
    setAllDates(generateDateRange(ev.dateStart, ev.dateEnd));
  }

  if (!event) return <div className="page">Lädt...</div>;

  const today = localDateStr(Date.now());
  const isToday = dateStr === today;

  const dateIdx = allDates.indexOf(dateStr);
  const prevDate = dateIdx > 0 ? allDates[dateIdx - 1] : null;
  const nextDate = dateIdx < allDates.length - 1 ? allDates[dateIdx + 1] : null;

  const displayDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('de-AT', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Determine day status for the "Starten" button
  const anfangsDone = fridges.filter((f) =>
    sessions.some((s) => s.fridgeId === f.id && s.label === 'Anfangsstand')
  );
  const endstandDone = fridges.filter((f) =>
    sessions.some((s) => s.fridgeId === f.id && s.label === 'Endstand')
  );
  const allDone = fridges.length > 0 && anfangsDone.length === fridges.length && endstandDone.length === fridges.length;

  let startLabel = null;
  let startFridge = null;
  let startType = null;

  if (fridges.length > 0 && !allDone) {
    if (anfangsDone.length < fridges.length) {
      startType = 'Anfangsstand';
      startFridge = fridges.find((f) =>
        !sessions.some((s) => s.fridgeId === f.id && s.label === 'Anfangsstand')
      );
      startLabel = anfangsDone.length === 0
        ? 'Anfangsstand starten'
        : `Anfangsstand fortfahren (${anfangsDone.length}/${fridges.length} erledigt)`;
    } else {
      startType = 'Endstand';
      startFridge = fridges.find((f) =>
        !sessions.some((s) => s.fridgeId === f.id && s.label === 'Endstand')
      );
      startLabel = endstandDone.length === 0
        ? 'Endstand starten'
        : `Endstand fortfahren (${endstandDone.length}/${fridges.length} erledigt)`;
    }
  }

  function handleStart() {
    if (!startFridge || !startType) return;
    navigate(`/count/${startFridge.id}?type=${encodeURIComponent(startType)}`);
  }

  return (
    <div className="page">
      <button className="btn-link back-link" onClick={() => navigate(`/event/${eventId}`)}>
        ← Zurück zur Veranstaltung
      </button>
      <h1>{event.name}</h1>
      <p className="muted">{displayDate}</p>

      {/* Starten / Tagesabschluss */}
      <div className="action-nav" style={{ marginBottom: '1rem' }}>
        {allDone ? (
          <button
            className="btn-primary"
            onClick={() => navigate(`/event/${eventId}/day/${dateStr}/abschluss`)}
          >
            Tagesabschluss berechnen →
          </button>
        ) : startLabel ? (
          <button className="btn-primary" onClick={handleStart}>
            {startLabel} →
          </button>
        ) : null}
        {sessions.length > 0 && (
          <button
            className="btn-secondary"
            onClick={() => navigate(`/event/${eventId}/day/${dateStr}/abschluss`)}
          >
            Tagesübersicht ansehen
          </button>
        )}
      </div>

      {/* Tag-Navigation */}
      <div className="row" style={{ marginBottom: '1rem' }}>
        <button
          className="btn-secondary"
          style={{ flex: 1 }}
          onClick={() => navigate(`/event/${eventId}/day/${prevDate}`)}
          disabled={!prevDate}
        >
          ← Vorheriger Tag
        </button>
        <button
          className="btn-secondary"
          style={{ flex: 1 }}
          onClick={() => navigate(`/event/${eventId}/day/${nextDate}`)}
          disabled={!nextDate}
        >
          Nächster Tag →
        </button>
      </div>

      {/* Kühlgeräte */}
      {fridges.map((fridge) => {
        const fridgeSessions = sessions.filter((s) => s.fridgeId === fridge.id);
        const hasAnfang = fridgeSessions.some((s) => s.label === 'Anfangsstand');
        const hasEnd = fridgeSessions.some((s) => s.label === 'Endstand');
        return (
          <div className="card" key={fridge.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0 }}>
                {fridge.label} — {fridge.type}
              </h2>
              <div style={{ display: 'flex', gap: 4 }}>
                {hasAnfang && <span className="status-chip green">A</span>}
                {hasEnd && <span className="status-chip blue">E</span>}
              </div>
            </div>
            {fridgeSessions.length === 0 ? (
              <p className="muted">Keine Zählungen</p>
            ) : (
              <ul className="product-list">
                {fridgeSessions.map((s) => (
                  <li
                    key={s.id}
                    onClick={() => navigate(`/summary/${s.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>
                      {s.label} — {formatDateTime(s.timestamp)}
                    </span>
                    <span className="muted">→</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
