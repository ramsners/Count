import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getEvent,
  getFridgesForEvent,
  addFridge,
  deleteFridge,
  getSessionsForFridge,
  getSessionsForFridgeOnDate,
  getAllProducts,
  updateEvent,
} from '../lib/db';
import { formatDateTime, generateDateRange } from '../lib/units';
import QRCode from 'qrcode';
import { generateAccessCode, listAccessCodesForEvent, deleteAccessCode } from '../lib/accessCodes';
import { subscribeFridgeLocks, getFridgeLock, unlockFridgeForced } from '../lib/locks';

function localDateStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [fridges, setFridges] = useState([]);
  const [sessionCounts, setSessionCounts] = useState({});
  const [countTypeModal, setCountTypeModal] = useState(null); // fridgeId
  const [accessCodes, setAccessCodes] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [fridgeLocks, setFridgeLocks] = useState({});
  const [allProducts, setAllProducts] = useState([]);
  const [sessionDates, setSessionDates] = useState([]);
  const [editingProducts, setEditingProducts] = useState(false);
  const [editProductIds, setEditProductIds] = useState([]);
  const [deleteConfirmFridge, setDeleteConfirmFridge] = useState(null); // fridge object
  const [creatingFridge, setCreatingFridge] = useState(false);

  useEffect(() => {
    load();
  }, [eventId]);

  useEffect(() => {
    // Lock-Events reloaden nur Kühlgeräte/Locks, nicht Access-Codes
    const unsub = subscribeFridgeLocks(Number(eventId), loadFridgesAndLocks);
    return unsub;
  }, [eventId]);

  async function load() {
    try {
      const [ev, fr, prods] = await Promise.all([
        getEvent(Number(eventId)),
        getFridgesForEvent(Number(eventId)),
        getAllProducts(),
      ]);
      setEvent(ev);
      setFridges(fr);
      setAllProducts(prods);
      setSessionDates(generateDateRange(ev.dateStart, ev.dateEnd));
      await loadFridgesAndLocks(fr);
      await loadAccessCodes();
    } catch (e) {
      console.error('EventDetail load error:', e);
    }
  }

  async function loadFridgesAndLocks(fridgeList) {
    const fr = fridgeList || (await getFridgesForEvent(Number(eventId)));
    if (!fridgeList) setFridges(fr);
    const counts = {};
    const locks = {};
    await Promise.all(
      fr.map(async (f) => {
        counts[f.id] = await getSessionsForFridge(f.id);
        locks[f.id] = await getFridgeLock(f.id);
      })
    );
    setSessionCounts(counts);
    setFridgeLocks(locks);
  }

  async function loadAccessCodes() {
    const codes = await listAccessCodesForEvent(Number(eventId));
    setAccessCodes(codes);
  }

  async function createDayCode() {
    setQrLoading(true);
    try {
      const today = new Date();
      const validFrom = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const validUntil = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      const code = await generateAccessCode(Number(eventId), validFrom, validUntil);
      const appUrl = window.location.origin + window.location.pathname;
      const accessUrl = `${appUrl}#/team/${code}`;
      const dataUrl = await QRCode.toDataURL(accessUrl, { width: 300, margin: 2 });
      setQrDataUrl(dataUrl);
      await loadAccessCodes();
    } finally {
      setQrLoading(false);
    }
  }

  async function createFridge(type) {
    if (creatingFridge) return;
    setCreatingFridge(true);
    try {
      await addFridge({ eventId: Number(eventId), type });
      load();
    } finally {
      setCreatingFridge(false);
    }
  }

  async function removeFridge(id) {
    await deleteFridge(id);
    setDeleteConfirmFridge(null);
    load();
  }

  async function startCounting(fridgeId, type) {
    setCountTypeModal(null);
    const today = localDateStr(Date.now());
    const todaysSessions = await getSessionsForFridgeOnDate(Number(fridgeId), today);

    // Block Anfangsstand if today's Endstand already exists
    if (type === 'Anfangsstand' && todaysSessions.some((s) => s.label === 'Endstand')) {
      alert('Ein Endstand wurde heute bereits gezählt. Kein neuer Anfangsstand möglich.');
      return;
    }

    const existing = todaysSessions.find((s) => s.label === type);
    if (existing) {
      navigate(`/correct/${existing.id}/choose`);
    } else {
      navigate(`/count/${fridgeId}?type=${type}`);
    }
  }

  function toggleProduct(id) {
    setEditProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function saveProducts() {
    await updateEvent({ ...event, productIds: editProductIds });
    setEditingProducts(false);
    await load();
  }

  if (!event) return <div className="page">Lädt...</div>;

  // Determine if today's Endstand is already done for each fridge (for modal)
  const todayStr = localDateStr(Date.now());
  const endstandDoneToday = {};
  for (const [fridgeId, sessions] of Object.entries(sessionCounts)) {
    endstandDoneToday[fridgeId] = sessions.some(
      (s) => s.label === 'Endstand' && localDateStr(s.timestamp) === todayStr
    );
  }

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

      {/* Kühlgeräte */}
      <div className="card">
        <h2>Kühlgeräte</h2>
        <div className="row">
          <button className="btn-secondary" onClick={() => createFridge('Kühlschrank')} disabled={creatingFridge}>
            + Kühlschrank
          </button>
          <button className="btn-secondary" onClick={() => createFridge('Kühltruhe')} disabled={creatingFridge}>
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
                  <button className="btn-link danger" onClick={() => setDeleteConfirmFridge(f)}>
                    Löschen
                  </button>
                </div>
                <p className="muted">
                  {sessions.length === 0
                    ? 'Noch nicht gezählt'
                    : `Letzte Zählung: ${last.label} — ${formatDateTime(last.timestamp)}`}
                </p>
                {fridgeLocks[f.id] && !fridgeLocks[f.id].isOwnLock ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="lock-badge" style={{ flex: 1 }}>
                      Wird gezählt von: {fridgeLocks[f.id].lockedByName}
                    </div>
                    <button
                      className="btn-link danger"
                      onClick={async () => {
                        if (!confirm(`Lock von ${fridgeLocks[f.id].lockedByName} wirklich aufheben?`)) return;
                        await unlockFridgeForced(f.id);
                        loadFridgesAndLocks();
                      }}
                    >
                      Lock aufheben
                    </button>
                  </div>
                ) : (
                  <button className="btn-primary" onClick={() => setCountTypeModal(f.id)}>
                    Neue Zählung starten
                  </button>
                )}
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

      {/* Produkte bearbeiten */}
      <div className="card">
        <h2>Produkte</h2>
        {!editingProducts ? (
          <>
            <p className="muted">{event.productIds.length} Produkte ausgewählt</p>
            <button
              className="btn-secondary"
              onClick={() => {
                setEditProductIds(event.productIds);
                setEditingProducts(true);
              }}
            >
              Produkte bearbeiten
            </button>
          </>
        ) : (
          <>
            <ul className="product-list" style={{ maxHeight: '16rem', overflowY: 'auto' }}>
              {allProducts.map((p) => (
                <li
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span>{p.name}</span>
                  <span>{editProductIds.includes(p.id) ? '✓' : ''}</span>
                </li>
              ))}
            </ul>
            <div className="row" style={{ marginTop: '0.75rem' }}>
              <button className="btn-primary" onClick={saveProducts}>
                Speichern
              </button>
              <button className="btn-link" onClick={() => setEditingProducts(false)}>
                Abbrechen
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tage */}
      {sessionDates.length > 0 && (
        <div className="card">
          <h2>Tage</h2>
          <ul className="product-list">
            {sessionDates.map((d) => (
              <li
                key={d}
                onClick={() => navigate(`/event/${eventId}/day/${d}`)}
                style={{ cursor: 'pointer' }}
              >
                <span>
                  {new Date(d + 'T12:00:00').toLocaleDateString('de-AT', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
                <span className="muted">→</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* QR-Code Teamzugang */}
      <div className="card">
        <h2>Teamzugang (QR-Code)</h2>
        <button className="btn-secondary" onClick={createDayCode} disabled={qrLoading}>
          {qrLoading ? 'Erstelle...' : '+ Code für heute erstellen'}
        </button>
        {qrDataUrl && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <img src={qrDataUrl} alt="QR-Code" style={{ maxWidth: 240 }} />
            <p className="muted">Gültig heute bis Mitternacht.</p>
            <a
              href={qrDataUrl}
              download="teamzugang-qr.png"
              className="btn-secondary"
              style={{ display: 'inline-block', marginTop: '0.5rem', textDecoration: 'none' }}
            >
              QR-Code herunterladen
            </a>
          </div>
        )}
        {accessCodes.length > 0 && (
          <ul className="product-list" style={{ marginTop: '1rem' }}>
            {accessCodes.map((c) => (
              <li key={c.id}>
                <span className="muted">
                  Gültig bis {new Date(c.validUntil).toLocaleString('de-AT')}
                </span>
                <button
                  className="btn-link danger"
                  onClick={async () => {
                    await deleteAccessCode(c.id);
                    loadAccessCodes();
                  }}
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Kühlgerät-Löschen-Bestätigung */}
      {deleteConfirmFridge && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmFridge(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Kühlgerät löschen?</h3>
            <p className="muted">
              <strong>{deleteConfirmFridge.label} ({deleteConfirmFridge.type})</strong> inkl. aller Zählungen wird unwiderruflich gelöscht.
            </p>
            <div className="row">
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => removeFridge(deleteConfirmFridge.id)}>
                Löschen
              </button>
              <button className="btn-secondary" onClick={() => setDeleteConfirmFridge(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zähltyp-Modal */}
      {countTypeModal && (
        <div className="modal-overlay" onClick={() => setCountTypeModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Was wird gezählt?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {!endstandDoneToday[countTypeModal] && (
                <button
                  className="btn-primary big"
                  onClick={() => startCounting(countTypeModal, 'Anfangsstand')}
                  style={{ textAlign: 'left', paddingLeft: '1rem' }}
                >
                  <div>☀ Anfangsstand</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.8 }}>Morgenzählung vor dem Event</div>
                </button>
              )}
              <button
                className="btn-secondary big"
                onClick={() => startCounting(countTypeModal, 'Endstand')}
                style={{ textAlign: 'left', paddingLeft: '1rem' }}
              >
                <div>🌙 Endstand</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.7 }}>Abendzählung nach dem Event</div>
              </button>
            </div>
            <button className="btn-link" onClick={() => setCountTypeModal(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
