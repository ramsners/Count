import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, addEvent, getAllProducts, deleteEvent } from '../lib/db';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showForm, setShowForm] = useState(false);

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
            <li key={ev.id}>
              <div>
                <Link to={`/event/${ev.id}`}>
                  <strong>{ev.name}</strong>
                </Link>
                <span className="muted">
                  {' '}
                  {ev.dateStart ? `— ${ev.dateStart}${ev.dateEnd && ev.dateEnd !== ev.dateStart ? ` bis ${ev.dateEnd}` : ''}` : ''}
                  {' '}— {ev.productIds.length} Produkte
                </span>
              </div>
              <div>
                <button className="btn-link danger" onClick={() => remove(ev.id)}>
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
