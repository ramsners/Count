import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, getFridgesForEvent, getSessionsForEventOnDate } from '../lib/db';
import { generateDateRange } from '../lib/units';

export default function Tagesabschluss() {
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

  const dateIdx = allDates.indexOf(dateStr);
  const prevDate = dateIdx > 0 ? allDates[dateIdx - 1] : null;
  const nextDate = dateIdx < allDates.length - 1 ? allDates[dateIdx + 1] : null;

  const displayDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('de-AT', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  // Per-fridge summary
  const fridgeSummaries = fridges.map((fridge) => {
    const anfang = sessions.find((s) => s.fridgeId === fridge.id && s.label === 'Anfangsstand');
    const end = sessions.find((s) => s.fridgeId === fridge.id && s.label === 'Endstand');

    const rows = [];
    if (anfang && end) {
      for (const e of end.entries) {
        const a = anfang.entries.find((ae) => ae.productId === e.productId);
        const anfangVal = a ? a.total : 0;
        rows.push({
          productId: e.productId,
          productName: e.productName,
          anfang: anfangVal,
          end: e.total,
          diff: e.total - anfangVal,
        });
      }
    } else if (end) {
      for (const e of end.entries) {
        rows.push({ productId: e.productId, productName: e.productName, anfang: '—', end: e.total, diff: null });
      }
    } else if (anfang) {
      for (const a of anfang.entries) {
        rows.push({ productId: a.productId, productName: a.productName, anfang: a.total, end: '—', diff: null });
      }
    }

    return { fridge, anfang, end, rows };
  });

  // Totals across all fridges (Endstand)
  const totals = {};
  for (const { rows } of fridgeSummaries) {
    for (const r of rows) {
      if (typeof r.end !== 'number') continue;
      if (!totals[r.productId]) totals[r.productId] = { name: r.productName, endTotal: 0, diffTotal: 0, hasDiff: false };
      totals[r.productId].endTotal += r.end;
      if (typeof r.diff === 'number') {
        totals[r.productId].diffTotal += r.diff;
        totals[r.productId].hasDiff = true;
      }
    }
  }
  const totalRows = Object.values(totals);

  return (
    <div className="page">
      <button className="btn-link back-link" onClick={() => navigate(`/event/${eventId}/day/${dateStr}`)}>
        ← Zurück zum Tag
      </button>
      <h1>Tagesabschluss</h1>
      <p className="muted">{event.name} — {displayDate}</p>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => navigate(`/event/${eventId}/day/${prevDate}/abschluss`)} disabled={!prevDate}>
          ← Vortag
        </button>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => navigate(`/event/${eventId}/day/${nextDate}/abschluss`)} disabled={!nextDate}>
          Nächster Tag →
        </button>
      </div>

      {/* Gesamtübersicht */}
      {totalRows.length > 0 && (
        <div className="card">
          <h2>Gesamtbestand Abend</h2>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th style={{ textAlign: 'right' }}>Endbestand</th>
                <th style={{ textAlign: 'right' }}>Differenz</th>
              </tr>
            </thead>
            <tbody>
              {totalRows.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td style={{ textAlign: 'right' }}>{p.endTotal}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: p.diffTotal < 0 ? '#dc2626' : p.diffTotal > 0 ? '#16a34a' : '#666' }}>
                    {p.hasDiff ? (p.diffTotal > 0 ? '+' : '') + p.diffTotal : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pro Kühlgerät */}
      {fridgeSummaries.map(({ fridge, anfang, end, rows }) => (
        <div className="card" key={fridge.id}>
          <h2>{fridge.label} — {fridge.type}</h2>
          {rows.length === 0 ? (
            <p className="muted">Keine Zählungen</p>
          ) : (
            <>
              {(!anfang || !end) && (
                <p className="muted" style={{ marginBottom: '0.5rem' }}>
                  {!anfang ? 'Kein Anfangsstand' : !end ? 'Kein Endstand' : ''}
                </p>
              )}
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th style={{ textAlign: 'right' }}>Anfang</th>
                    <th style={{ textAlign: 'right' }}>Ende</th>
                    {anfang && end && <th style={{ textAlign: 'right' }}>Diff</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.productId}>
                      <td>{r.productName}</td>
                      <td style={{ textAlign: 'right' }}>{r.anfang}</td>
                      <td style={{ textAlign: 'right' }}>{r.end}</td>
                      {anfang && end && (
                        <td style={{ textAlign: 'right', fontWeight: 600, color: r.diff < 0 ? '#dc2626' : r.diff > 0 ? '#16a34a' : '#666' }}>
                          {r.diff > 0 ? '+' : ''}{r.diff}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ))}

      {sessions.length === 0 && (
        <div className="card">
          <p className="muted">Keine Zählungen an diesem Tag vorhanden.</p>
        </div>
      )}
    </div>
  );
}
