import { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  getSession,
  getEvent,
  getFridgesForEvent,
  getSessionsForFridge,
  getFridgeById,
  getSessionsForFridgeOnDate,
} from '../lib/db';
import { formatDateTime } from '../lib/units';
import {
  connectPrinter,
  isPrinterConnected,
  isWebBluetoothSupported,
  printReceipt,
} from '../lib/printer';
import { uploadSessionPhoto, getSessionPhotos, getLastFridgePhoto } from '../lib/photos';

function localDateStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Summary() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isTeamRoute = location.pathname.startsWith('/team/');
  const teamCode = isTeamRoute ? location.pathname.split('/')[2] : null;

  const [session, setSession] = useState(null);
  const [event, setEvent] = useState(null);
  const [fridge, setFridge] = useState(null);
  const [previousSession, setPreviousSession] = useState(null);
  const [nextFridge, setNextFridge] = useState(null);
  const [printerStatus, setPrinterStatus] = useState('nicht verbunden');
  const [printing, setPrinting] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [lastFridgePhoto, setLastFridgePhoto] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState(false);
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(true);

  useEffect(() => {
    load();
  }, [sessionId]);

  async function load() {
    const s = await getSession(Number(sessionId));
    setSession(s);
    const ev = await getEvent(s.eventId);
    setEvent(ev);
    const fr = await getFridgeById(s.fridgeId);
    setFridge(fr);

    const allSessions = await getSessionsForFridge(s.fridgeId);
    const idx = allSessions.findIndex((x) => x.id === s.id);
    setPreviousSession(idx > 0 ? allSessions[idx - 1] : null);

    // Find next fridge that still needs this count type today
    const today = localDateStr(Date.now());
    const allFridges = await getFridgesForEvent(s.eventId);
    let found = null;
    for (const f of allFridges) {
      if (f.id === s.fridgeId) continue;
      const todaySessions = await getSessionsForFridgeOnDate(f.id, today);
      if (!todaySessions.some((ts) => ts.label === s.label)) {
        found = f;
        break;
      }
    }
    setNextFridge(found);

    const p = await getSessionPhotos(Number(sessionId));
    setPhotos(p);
    const lastPhoto = await getLastFridgePhoto(s.fridgeId);
    if (lastPhoto && !p.find((x) => x.id === lastPhoto.id)) {
      setLastFridgePhoto(lastPhoto);
    }
  }

  const diffWarnings = [];
  // Only warn for Nachtschwund: Anfangsstand following an Endstand (overnight comparison)
  if (session && previousSession &&
      session.label === 'Anfangsstand' && previousSession.label === 'Endstand') {
    for (const e of session.entries) {
      const prevEntry = previousSession.entries.find((p) => p.productId === e.productId);
      if (prevEntry) {
        const diff = e.total - prevEntry.total;
        if (diff < 0) {
          diffWarnings.push({ productName: e.productName, diff });
        }
      }
    }
  }

  async function handlePhotoCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      await uploadSessionPhoto(Number(sessionId), file);
      const updated = await getSessionPhotos(Number(sessionId));
      setPhotos(updated);
      setShowPhotoPrompt(false);
      setPhotoUploadSuccess(true);
      setTimeout(() => setPhotoUploadSuccess(false), 3000);
    } catch (err) {
      alert('Foto-Upload fehlgeschlagen: ' + err.message);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleConnect() {
    try {
      const name = await connectPrinter();
      setPrinterStatus(`verbunden: ${name}`);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handlePrint() {
    if (!isPrinterConnected()) {
      alert('Bitte zuerst den Drucker verbinden.');
      return;
    }
    setPrinting(true);
    try {
      await printReceipt({
        eventName: event.name,
        fridgeLabel: fridge.label,
        timestamp: session.timestamp,
        entries: session.entries,
        diffWarnings,
      });
    } catch (err) {
      alert('Druckfehler: ' + err.message);
    } finally {
      setPrinting(false);
    }
  }

  async function goNext() {
    if (!nextFridge || !session) return;
    const today = localDateStr(Date.now());
    const todaySessions = await getSessionsForFridgeOnDate(nextFridge.id, today);
    const existing = todaySessions.find((ts) => ts.label === session.label);
    if (existing) {
      // Already counted → correction mode
      navigate(`/correct/${existing.id}/choose`);
      return;
    }
    const type = encodeURIComponent(session.label);
    if (isTeamRoute) {
      navigate(`/team/${teamCode}/count/${nextFridge.id}?type=${type}&teamCode=${teamCode}`);
    } else {
      navigate(`/count/${nextFridge.id}?type=${type}`);
    }
  }

  if (!session || !event || !fridge) return <div className="page">Lädt...</div>;

  const backUrl = isTeamRoute ? null : `/event/${event.id}`;

  return (
    <div className="page">
      <h1>
        {fridge.label} — {session.label}
      </h1>
      <p className="muted">
        {event.name} — {formatDateTime(session.timestamp)}
      </p>

      {/* Hauptnavigation: immer direkt sichtbar */}
      <div className="action-nav">
        {isTeamRoute ? (
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            ← Zurück
          </button>
        ) : (
          <Link to={backUrl} className="btn-secondary">
            ← Zurück zur Veranstaltung
          </Link>
        )}
        {nextFridge ? (
          <button className="btn-primary" onClick={goNext}>
            Weiter: {nextFridge.label} ({nextFridge.type}) →
          </button>
        ) : !isTeamRoute && session.label === 'Endstand' ? (
          <button
            className="btn-primary"
            onClick={() => navigate(`/event/${event.id}/day/${localDateStr(session.timestamp)}/abschluss`)}
          >
            Tagesabschluss berechnen →
          </button>
        ) : null}
      </div>

      <div className="card">
        <table className="summary-table">
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {session.entries.map((e) => (
              <tr key={e.productId}>
                <td>{e.productName}</td>
                <td>{e.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diffWarnings.length > 0 && (
        <div className="card warning-card">
          <h2>⚠ Differenz zur vorherigen Zählung</h2>
          <ul>
            {diffWarnings.map((w) => (
              <li key={w.productName}>
                {w.productName}: {w.diff}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastFridgePhoto && (
        <div className="card">
          <h2>Letzte Aufnahme zum Vergleich</h2>
          <img
            src={lastFridgePhoto.url}
            alt="Letzte Zählung"
            style={{ width: '100%', borderRadius: 8 }}
          />
          <p className="muted">{new Date(lastFridgePhoto.createdAt).toLocaleString('de-AT')}</p>
        </div>
      )}

      <div className="card">
        <h2>Foto dieser Zählung</h2>
        {showPhotoPrompt && photos.length === 0 && (
          <p className="muted">Foto vom Kühlgerät machen zur Dokumentation?</p>
        )}
        {photoUploadSuccess && (
          <p style={{ color: '#16a34a', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Foto hochgeladen!
          </p>
        )}
        {photos.map((p) => (
          <img
            key={p.id}
            src={p.url}
            alt="Zählfoto"
            style={{ width: '100%', borderRadius: 8, marginBottom: '0.5rem' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ))}
        <label className="btn-secondary" style={{ display: 'block', cursor: 'pointer', marginTop: '0.5rem', textAlign: 'center' }}>
          {photoUploading ? 'Hochladen...' : photos.length > 0 ? 'Weiteres Foto aufnehmen' : 'Foto aufnehmen'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handlePhotoCapture}
            disabled={photoUploading}
          />
        </label>
      </div>

      {isWebBluetoothSupported() ? (
        <div className="card">
          <h2>Drucken</h2>
          <p className="muted">Status: {printerStatus}</p>
          <div className="row">
            <button className="btn-secondary" onClick={handleConnect}>
              Drucker verbinden
            </button>
            <button className="btn-primary" onClick={handlePrint} disabled={printing}>
              {printing ? 'Drucke...' : 'Bon drucken'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
