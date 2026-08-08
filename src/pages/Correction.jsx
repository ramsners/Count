import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, getEvent, getAllProducts, updateSession, getFridgeById } from '../lib/db';
import { computeTotal } from '../lib/units';

export default function Correction() {
  const { sessionId, productId, code } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [event, setEvent] = useState(null);
  const [fridge, setFridge] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [sessionId]);

  async function load() {
    setLoading(true);
    const s = await getSession(Number(sessionId));
    setSession(s);
    const ev = await getEvent(s.eventId);
    setEvent(ev);
    const fr = await getFridgeById(s.fridgeId);
    setFridge(fr);
    const prods = await getAllProducts();
    setAllProducts(prods);
    setLoading(false);
  }

  useEffect(() => {
    if (session && productId !== 'choose') {
      const existing = session.entries.find((e) => e.productId === Number(productId));
      if (existing) {
        setEntry({
          loose: String(existing.loose),
          gebindeCounts: { ...existing.gebindeCounts },
        });
      }
    }
  }, [session, productId]);

  if (loading || !session || !event || !fridge) return <div className="page">Lädt...</div>;

  // Produktauswahl-Screen
  if (productId === 'choose') {
    return (
      <div className="page">
        <div className="counting-header">
          <span className="muted">{fridge.label} — {event.name}</span>
          <span className="counting-type-badge correction">Korrektur: {session.label}</span>
        </div>
        <h2>Welches Produkt korrigieren?</h2>
        <ul className="product-list">
          {session.entries.map((e) => (
            <li key={e.productId}>
              <button
                className="btn-secondary"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => code
                  ? navigate(`/team/${code}/correct/${sessionId}/${e.productId}`)
                  : navigate(`/correct/${sessionId}/${e.productId}`)
                }
              >
                <strong>{e.productName}</strong>
                <span className="muted"> — aktuell: {e.total} Stk.</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-link" onClick={() => navigate(-1)}>Abbrechen</button>
      </div>
    );
  }

  // Zähl-Screen für ein Produkt
  const product = allProducts.find((p) => p.id === Number(productId));
  if (!product || !entry) return <div className="page">Produkt nicht gefunden.</div>;

  // Gespeicherte Gebinde-Definition aus der Session verwenden (schützt vor nachträglichen Änderungen)
  const sessionEntry = session.entries.find((e) => e.productId === Number(productId));
  const productWithSnapshot = sessionEntry?.gebinde ? { ...product, gebinde: sessionEntry.gebinde } : product;
  const currentTotal = computeTotal(entry.loose, entry.gebindeCounts, productWithSnapshot);

  function updateLoose(val) {
    setEntry((prev) => ({ ...prev, loose: val }));
  }
  function updateGebinde(label, val) {
    setEntry((prev) => ({ ...prev, gebindeCounts: { ...prev.gebindeCounts, [label]: val } }));
  }

  async function saveCorrection() {
    if (saving) return;
    setSaving(true);
    try {
      const updatedEntries = session.entries.map((e) => {
        if (e.productId !== Number(productId)) return e;
        return {
          ...e,
          loose: Number(entry.loose) || 0,
          gebindeCounts: entry.gebindeCounts,
          total: currentTotal,
        };
      });
      await updateSession({ ...session, entries: updatedEntries });
      if (code) {
        navigate(`/team/${code}/summary/${sessionId}?corrected=1`);
      } else {
        navigate(`/summary/${sessionId}?corrected=1`);
      }
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message);
      setSaving(false);
    }
  }

  return (
    <div className="page counting-page">
      <div className="counting-header">
        <span className="muted">{fridge.label} — Korrektur {session.label}</span>
      </div>
      <h1 className="product-title">{product.name}</h1>
      <div className="count-field">
        <label>Lose Flaschen / Stück</label>
        <input
          className="input big"
          type="number"
          inputMode="numeric"
          autoFocus
          value={entry.loose}
          onChange={(e) => updateLoose(e.target.value)}
          placeholder="0"
        />
      </div>
      {productWithSnapshot.gebinde?.map((g) => (
        <div className="count-field" key={g.label}>
          <label>{g.label} (à {g.units} Stk.)</label>
          <input
            className="input big"
            type="number"
            inputMode="numeric"
            value={entry.gebindeCounts[g.label] || ''}
            onChange={(e) => updateGebinde(g.label, e.target.value)}
            placeholder="0"
          />
        </div>
      ))}
      <div className="total-display">Gesamt: {currentTotal} Stk.</div>
      <div className="counting-nav">
        <button className="btn-secondary big" onClick={() => navigate(-1)}>Abbrechen</button>
        <button className="btn-primary big" onClick={saveCorrection} disabled={saving}>
          {saving ? 'Speichert...' : 'Korrektur speichern'}
        </button>
      </div>
    </div>
  );
}
