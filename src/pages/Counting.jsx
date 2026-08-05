import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getAllProducts,
  getEvent,
  getFridgeById,
  getLastEndstandForFridge,
  addSession,
} from '../lib/db';
import { computeTotal } from '../lib/units';

export default function Counting() {
  const { fridgeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const countType = searchParams.get('type') || 'Anfangsstand';

  const [fridge, setFridge] = useState(null);
  const [event, setEvent] = useState(null);
  const [products, setProducts] = useState([]);
  const [lastEndstand, setLastEndstand] = useState(null);
  const [step, setStep] = useState(0);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [fridgeId]);

  async function load() {
    setLoading(true);
    const allProducts = await getAllProducts();
    const fr = await getFridgeById(Number(fridgeId));
    setFridge(fr);
    const ev = await getEvent(fr.eventId);
    setEvent(ev);
    const eventProducts = allProducts.filter((p) => ev.productIds.includes(p.id));
    setProducts(eventProducts);
    const last = await getLastEndstandForFridge(Number(fridgeId));
    setLastEndstand(last);
    const initialEntries = {};
    eventProducts.forEach((p) => {
      initialEntries[p.id] = { loose: '', gebindeCounts: {} };
    });
    setEntries(initialEntries);
    setLoading(false);
  }

  if (loading || !fridge || !event) return <div className="page">Lädt...</div>;

  if (products.length === 0) {
    return (
      <div className="page">
        <p>Für diese Veranstaltung sind keine Produkte ausgewählt.</p>
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          Zurück
        </button>
      </div>
    );
  }

  const product = products[step];
  const entry = entries[product.id] || { loose: '', gebindeCounts: {} };

  function updateLoose(val) {
    setEntries((prev) => ({ ...prev, [product.id]: { ...prev[product.id], loose: val } }));
  }

  function updateGebinde(label, val) {
    setEntries((prev) => ({
      ...prev,
      [product.id]: {
        ...prev[product.id],
        gebindeCounts: { ...prev[product.id].gebindeCounts, [label]: val },
      },
    }));
  }

  const currentTotal = computeTotal(entry.loose, entry.gebindeCounts, product);

  let diffWarning = null;
  if (lastEndstand && countType === 'Anfangsstand') {
    const lastEntry = lastEndstand.entries.find((e) => e.productId === product.id);
    if (lastEntry) {
      const diff = currentTotal - lastEntry.total;
      if (diff < 0) {
        diffWarning = `Minus ${Math.abs(diff)} gegenüber letztem Endstand (${lastEntry.total} → ${currentTotal})`;
      }
    }
  }

  function goNext() {
    if (step < products.length - 1) {
      setStep(step + 1);
    } else {
      finishCounting();
    }
  }

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  async function finishCounting() {
    const finalEntries = products.map((p) => {
      const e = entries[p.id] || { loose: '', gebindeCounts: {} };
      return {
        productId: p.id,
        productName: p.name,
        loose: Number(e.loose) || 0,
        gebindeCounts: e.gebindeCounts,
        total: computeTotal(e.loose, e.gebindeCounts, p),
      };
    });
    const session = {
      eventId: event.id,
      fridgeId: fridge.id,
      timestamp: Date.now(),
      label: countType,
      entries: finalEntries,
    };
    const id = await addSession(session);
    const teamCode = searchParams.get('teamCode');
    if (teamCode) {
      navigate(`/team/${teamCode}/summary/${id}`);
    } else {
      navigate(`/summary/${id}`);
    }
  }

  return (
    <div className="page counting-page">
      <div className="counting-header">
        <span className="muted">
          {fridge.label} — {event.name}
        </span>
        <span className="counting-type-badge">{countType}</span>
        <span className="muted">
          {step + 1} / {products.length}
        </span>
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

      {product.gebinde?.map((g) => (
        <div className="count-field" key={g.label}>
          <label>
            {g.label} (à {g.units} Stk.)
          </label>
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

      {diffWarning && <div className="diff-warning">⚠ {diffWarning}</div>}

      <div className="counting-nav">
        <button className="btn-secondary big" onClick={goBack} disabled={step === 0}>
          Zurück
        </button>
        <button className="btn-primary big" onClick={goNext}>
          {step < products.length - 1 ? 'Weiter' : 'Fertig'}
        </button>
      </div>
    </div>
  );
}
