import { useEffect, useState } from 'react';
import { getAllEvents, getFridgesForEvent, getAllSessionsForEvent } from '../lib/db';

function localDateStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Auswertung() {
  const [events, setEvents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]); // [{productName, totalConsumed, perEvent: {eventId: total}}]
  const [eventMap, setEventMap] = useState({}); // {eventId: event}
  const [error, setError] = useState(null);

  useEffect(() => {
    getAllEvents()
      .then((evs) => {
        setEvents(evs);
        const map = {};
        evs.forEach((e) => { map[e.id] = e; });
        setEventMap(map);
      })
      .catch((e) => setError(e.message));
  }, []);

  function toggleEvent(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(events.map((e) => e.id)));
  }

  async function calculate() {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      // Für jedes ausgewählte Event alle Sessions + Kühlgeräte laden
      const results = await Promise.all(
        [...selectedIds].map(async (eventId) => {
          const [fridges, sessions] = await Promise.all([
            getFridgesForEvent(eventId),
            getAllSessionsForEvent(eventId),
          ]);
          return { eventId, fridges, sessions };
        })
      );

      // Verbrauch aggregieren: pro Event, pro Kühlgerät, pro Tag → Anfang/End-Paar
      const productTotals = {}; // {productName: {total, perEvent: {eventId: total}}}

      for (const { eventId, fridges, sessions } of results) {
        // Sessions nach fridgeId + Datum gruppieren
        const byFridgeDate = {};
        for (const s of sessions) {
          const key = `${s.fridgeId}__${localDateStr(s.timestamp)}`;
          if (!byFridgeDate[key]) byFridgeDate[key] = [];
          byFridgeDate[key].push(s);
        }

        for (const daySessions of Object.values(byFridgeDate)) {
          const anfang = daySessions.find((s) => s.label === 'Anfangsstand');
          const end = daySessions.find((s) => s.label === 'Endstand');
          if (!anfang || !end) continue;

          for (const endEntry of end.entries) {
            const anfangEntry = anfang.entries.find((a) => a.productId === endEntry.productId);
            const anfangVal = anfangEntry ? anfangEntry.total : 0;
            const consumed = anfangVal - endEntry.total; // positiv = verbraucht

            const name = endEntry.productName;
            if (!productTotals[name]) productTotals[name] = { total: 0, perEvent: {} };
            productTotals[name].total += consumed;
            productTotals[name].perEvent[eventId] = (productTotals[name].perEvent[eventId] || 0) + consumed;
          }
        }
      }

      const sorted = Object.entries(productTotals)
        .map(([name, data]) => ({ productName: name, ...data }))
        .sort((a, b) => b.total - a.total);

      setRows(sorted);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedEvents = events.filter((e) => selectedIds.has(e.id));

  return (
    <div className="page">
      <h1>Auswertung</h1>
      <p className="muted">Verbrauch über Veranstaltungen hinweg vergleichen.</p>

      {error && (
        <div className="card warning-card"><p>{error}</p></div>
      )}

      <div className="card">
        <h2>Veranstaltungen auswählen</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}>
          <button className="btn-secondary" onClick={selectAll}>Alle auswählen</button>
          <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}>Auswahl löschen</button>
        </div>
        <ul className="checkbox-list">
          {events.map((ev) => (
            <li key={ev.id}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(ev.id)}
                  onChange={() => toggleEvent(ev.id)}
                />
                <span>
                  <strong>{ev.name}</strong>
                  {ev.dateStart && <span className="muted"> — {ev.dateStart}{ev.dateEnd && ev.dateEnd !== ev.dateStart ? ` bis ${ev.dateEnd}` : ''}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={calculate} disabled={selectedIds.size === 0 || loading}>
          {loading ? 'Lädt...' : `Auswertung berechnen (${selectedIds.size} Veranstaltung${selectedIds.size !== 1 ? 'en' : ''})`}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2>Verbrauch Gesamt</h2>
            <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }} onClick={() => window.print()}>
              Drucken / PDF
            </button>
          </div>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th style={{ textAlign: 'right' }}>Gesamt</th>
                {selectedEvents.map((ev) => (
                  <th key={ev.id} style={{ textAlign: 'right', fontSize: '0.8rem', maxWidth: 80 }}>{ev.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productName}>
                  <td>{r.productName}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.total}</td>
                  {selectedEvents.map((ev) => (
                    <td key={ev.id} style={{ textAlign: 'right', color: '#555' }}>
                      {r.perEvent[ev.id] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Nur Tage mit vollständigem Anfangs- und Endstand werden ausgewertet.
          </p>
        </div>
      )}
    </div>
  );
}
