import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, addEvent, getAllProducts, deleteEvent } from '../lib/db';
import { generateDateRange } from '../lib/units';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [eventDates, setEventDates] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [evs, prods] = await Promise.all([getAllEvents(), getAllProducts()]);
    setEvents(evs.sort((a, b) => (b.dateStart || '').localeCompare(a.dateStart || '')));
    setProducts(prods.sort((a, b) => a.name.localeCompare(b.name)));
  }

  function toggleProduct(id) {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function toggleDays(ev) {
    const evId = ev.id;
    if (expandedEventId === evId) {
      setExpandedEventId(null);
      return;
    }
    setExpandedEventId(evId);
    if (!eventDates[evId]) {
      const dates = generateDateRange(ev.dateStart, ev.dateEnd);
      setEventDates((prev) => ({ ...prev, [evId]: dates }));
    }
  }

  async function createEvent() {
    if (!name.trim() || selectedProductIds.length === 0) {
      alert('Bitte Name und mindestens ein Produkt angeben.');
      return;
    }
    await addEvent({
      name: name.trim(),
      dateStart: dateStart || null,
      dateEnd: dateEnd || dateStart || null,
      productIds: selectedProductIds,
      createdAt: Date.now(),
    });
    setName('');
    setDateStart('');
    setDateEnd('');
    setSelectedProductIds([]);
    setShowForm(false);
    load();
  }

  async function remove(id) {
    if (confirm('Veranstaltung inkl. aller Kühlgeräte und Zählungen wirklich löschen?')) {
      await deleteEvent(id);
      load();
    }
  }

  function formatDay(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-AT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  }

  return (
    <div className="page">
      <h1>Veranstaltungen</h1>

      {!showForm && (
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Neue Veranstaltung
        </button>
      )}

      {showForm && (
        <div className="card">
          <h2>Neue Veranstaltung</h2>
          <input
            className="input"
            placeholder="Name, z.B. Hochzeit Ritt"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="row">
            <label className="field">
              Start
              <input
                className="input"
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
              />
            </label>
            <label className="field">
              Ende (optional, für mehrtägig)
              <input
                className="input"
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
              />
            </label>
          </div>

          <h3>Produkte für diese Veranstaltung</h3>
          {products.length === 0 && (
            <p className="muted">Noch keine Produkte angelegt. Zuerst unter "Produkte" welche anlegen.</p>
          )}
          <ul className="checkbox-list">
            {products.map((p) => (
              <li key={p.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  {p.name}
                </label>
              </li>
            ))}
          </ul>

          <div className="row">
            <button className="btn-primary" onClick={createEvent}>
              Veranstaltung anlegen
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Bestehende Veranstaltungen</h2>
        <ul className="product-list">
          {events.map((ev) => (
            <li key={ev.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/event/${ev.id}`}>
                    <strong>{ev.name}</strong>
                  </Link>
                  <div className="muted" style={{ marginTop: 2 }}>
                    {ev.dateStart
                      ? `${ev.dateStart}${ev.dateEnd && ev.dateEnd !== ev.dateStart ? ` – ${ev.dateEnd}` : ''}`
                      : ''}
                    {' '}— {ev.productIds.length} Produkte
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                  <button className="btn-link" onClick={() => toggleDays(ev)}>
                    Tage {expandedEventId === ev.id ? '▲' : '▼'}
                  </button>
                  <button className="btn-link danger" onClick={() => remove(ev.id)}>
                    Löschen
                  </button>
                </div>
              </div>

              {expandedEventId === ev.id && (
                <div className="day-list-expand">
                  {!eventDates[ev.id] ? (
                    <span className="muted">Lädt...</span>
                  ) : eventDates[ev.id].length === 0 ? (
                    <span className="muted">Noch keine Zählungen</span>
                  ) : (
                    <ul>
                      {eventDates[ev.id].map((d) => (
                        <li key={d}>
                          <Link to={`/event/${ev.id}/day/${d}`}>{formatDay(d)}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
