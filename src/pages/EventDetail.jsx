import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getEvent,
  getFridgesForEvent,
  addFridge,
  deleteFridge,
  getSessionsForFridge,
  getSessionsForFridgeOnDate,
} from '../lib/db';
import { formatDateTime } from '../lib/units';
import QRCode from 'qrcode';
import { generateAccessCode, listAccessCodesForEvent, deleteAccessCode } from '../lib/accessCodes';
import { subscribeFridgeLocks, getFridgeLock } from '../lib/locks';

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [fridges, setFridges] = useState([]);
  const [sessionCounts, setSessionCounts] = useState({});
  const [countTypeModal, setCountTypeModal] = useState(null);
  const [accessCodes, setAccessCodes] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [fridgeLocks, setFridgeLocks] = useState({}); // fridgeId -> FridgeLock|null

  useEffect(() => {
    load();
  }, [eventId]);

  useEffect(() => {
    const unsub = subscribeFridgeLocks(Number(eventId), load);
    return unsub;
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
    const locks = {};
    for (const f of fr) {
      locks[f.id] = await getFridgeLock(f.id);
    }
    setFridgeLocks(locks);
    await loadAccessCodes();
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
    await addFridge({ eventId: Number(eventId), type });
    load();
  }

  async function removeFridge(id) {
    if (confirm('Kühlgerät inkl. aller Zählungen löschen?')) {
      await deleteFridge(id);
      load();
    }
  }

  async function startCounting(fridgeId, type) {
    setCountTypeModal(null);
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const todaysSessions = await getSessionsForFridgeOnDate(Number(fridgeId), today);
    const existing = todaysSessions.find((s) => s.label === type);
    if (existing) {
      navigate(`/correct/${existing.id}/choose`);
    } else {
      navigate(`/count/${fridgeId}?type=${type}`);
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
                {fridgeLocks[f.id] && !fridgeLocks[f.id].isOwnLock ? (
                  <div className="lock-badge">
                    🔒 Wird gezählt von: {fridgeLocks[f.id].lockedByName}
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => setCountTypeModal(f.id)}
                  >
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
      <div className="card">
        <h2>Teamzugang (QR-Code)</h2>
        <button className="btn-secondary" onClick={createDayCode} disabled={qrLoading}>
          {qrLoading ? 'Erstelle...' : '+ Code für heute erstellen'}
        </button>
        {qrDataUrl && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <img src={qrDataUrl} alt="QR-Code" style={{ maxWidth: 240 }} />
            <p className="muted">Gültig heute bis Mitternacht. QR-Code abfotografieren.</p>
          </div>
        )}
        {accessCodes.length > 0 && (
          <ul className="product-list" style={{ marginTop: '1rem' }}>
            {accessCodes.map((c) => (
              <li key={c.id}>
                <span className="muted">
                  Gültig bis {new Date(c.validUntil).toLocaleString('de-AT')}
                </span>
                <button className="btn-link danger" onClick={async () => { await deleteAccessCode(c.id); loadAccessCodes(); }}>
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {countTypeModal && (
        <div className="modal-overlay" onClick={() => setCountTypeModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Welcher Zähltyp?</h3>
            <div className="row">
              <button
                className="btn-primary big"
                onClick={() => startCounting(countTypeModal, 'Anfangsstand')}
              >
                Anfangsstand
              </button>
              <button
                className="btn-secondary big"
                onClick={() => startCounting(countTypeModal, 'Endstand')}
              >
                Endstand
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
