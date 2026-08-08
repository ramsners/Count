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
import { lockFridge, unlockFridge, getFridgeLock } from '../lib/locks';

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
  const [saving, setSaving] = useState(false);
  const [lockError, setLockError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    load();
  }, [fridgeId]);

  useEffect(() => {
    return () => { unlockFridge(Number(fridgeId)); };
  }, [fridgeId]);

  async function load() {
    setLoading(true);
    try {
      const allProducts = await getAllProducts();
      const fr = await getFridgeById(Number(fridgeId));
      setFridge(fr);
      // Lock setzen — gespeicherter Name hat Vorrang vor User-Agent-Fallback
      const lockName = localStorage.getItem('festwerk-user-name') || (navigator.userAgent.includes('Mobile') ? 'Handy' : 'PC');
      const locked = await lockFridge(Number(fridgeId), fr.eventId, lockName);
      if (!locked) {
        const existingLock = await getFridgeLock(Number(fridgeId));
        const holder = existingLock?.lockedByName || 'jemand anderem';
        setLockError(`${fr.label} wird gerade von ${holder} gezählt.`);
        return;
      }
      const ev = await getEvent(fr.eventId);
      setEvent(ev);
      const eventProducts = allProducts.filter((p) => ev.productIds.includes(p.id));
      setProducts(eventProducts);
      const last = await getLastEndstandForFridge(Number(fridgeId));
      setLastEndstand(last);

      // Draft aus localStorage wiederherstellen (verhindert Datenverlust bei Zurück-Navigation)
      const draftKey = `counting-draft-${fridgeId}-${countType}`;
      let savedDraft = null;
      try { savedDraft = JSON.parse(localStorage.getItem(draftKey)); } catch {}

      const initialEntries = {};
      eventProducts.forEach((p) => {
        initialEntries[p.id] = savedDraft?.[p.id] || { loose: '', gebindeCounts: {} };
      });
      setEntries(initialEntries);
    } catch (e) {
      setLockError(`Ladefehler: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (lockError) return (
    <div className="page">
      <div className="card warning-card">
        <h2>Gerät gesperrt</h2>
        <p>{lockError}</p>
        <button className="btn-secondary" onClick={() => navigate(-1)}>← Zurück</button>
      </div>
    </div>
  );

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

  const draftKey = `counting-draft-${fridgeId}-${countType}`;

  function updateLoose(val) {
    setEntries((prev) => {
      const next = { ...prev, [product.id]: { ...prev[product.id], loose: val } };
      localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
  }

  function updateGebinde(label, val) {
    setEntries((prev) => {
      const next = {
        ...prev,
        [product.id]: {
          ...prev[product.id],
          gebindeCounts: { ...prev[product.id].gebindeCounts, [label]: val },
        },
      };
      localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
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
      setConfirming(true); // Bestätigungsübersicht anzeigen
    }
  }

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  async function finishCounting() {
    if (saving) return;
    setSaving(true);
    const finalEntries = products.map((p) => {
      const e = entries[p.id] || { loose: '', gebindeCounts: {} };
      return {
        productId: p.id,
        productName: p.name,
        loose: Number(e.loose) || 0,
        gebindeCounts: e.gebindeCounts,
        // Gebinde-Definition als Snapshot speichern — schützt vor nachträglichen Änderungen
        gebinde: p.gebinde || [],
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
    localStorage.removeItem(draftKey); // Draft nach erfolgreichem Speichern löschen
    await unlockFridge(fridge.id);
    const teamCode = searchParams.get('teamCode');
    if (teamCode) {
      navigate(`/team/${teamCode}/summary/${id}`);
    } else {
      navigate(`/summary/${id}`);
    }
  }

  // Bestätigungsübersicht vor dem Speichern
  if (confirming) {
    const summary = products.map((p) => ({
      name: p.name,
      total: computeTotal(entries[p.id]?.loose, entries[p.id]?.gebindeCounts, p),
    }));
    return (
      <div className="page">
        <div className="counting-header">
          <span className="muted">{fridge.label} — {event.name}</span>
          <span className="counting-type-badge">{countType}</span>
        </div>
        <h2>Zählung prüfen</h2>
        <p className="muted">Alle Produkte gezählt? Jetzt speichern oder zurück zur Korrektur.</p>
        <div className="card">
          <table className="summary-table">
            <thead><tr><th>Produkt</th><th style={{ textAlign: 'right' }}>Gezählt</th></tr></thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="counting-nav">
          <button className="btn-secondary big" onClick={() => setConfirming(false)}>
            ← Zurück
          </button>
          <button className="btn-primary big" onClick={finishCounting} disabled={saving}>
            {saving ? 'Speichert...' : 'Speichern ✓'}
          </button>
        </div>
      </div>
    );
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
        <button className="btn-primary big" onClick={goNext} disabled={saving}>
          {saving ? 'Speichert...' : step < products.length - 1 ? 'Weiter' : 'Fertig'}
        </button>
      </div>
    </div>
  );
}
