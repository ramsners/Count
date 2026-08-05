import { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getSession, getEvent, getFridgesForEvent, getSessionsForFridge, getFridgeById } from '../lib/db';
import { formatDateTime } from '../lib/units';
import {
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  isWebBluetoothSupported,
  printReceipt,
} from '../lib/printer';
import { uploadSessionPhoto, getSessionPhotos, getLastFridgePhoto } from '../lib/photos';

export default function Summary() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isTeamRoute = location.pathname.startsWith('/team/');
  const [session, setSession] = useState(null);
  const [event, setEvent] = useState(null);
  const [fridge, setFridge] = useState(null);
  const [previousSession, setPreviousSession] = useState(null);
  const [printerStatus, setPrinterStatus] = useState('nicht verbunden');
  const [printing, setPrinting] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [lastFridgePhoto, setLastFridgePhoto] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
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

    const p = await getSessionPhotos(Number(sessionId));
    setPhotos(p);
    const lastPhoto = await getLastFridgePhoto(s.fridgeId);
    // Nur das letzte Foto anzeigen wenn es nicht von dieser Session ist
    if (lastPhoto && !p.find((x) => x.id === lastPhoto.id)) {
      setLastFridgePhoto(lastPhoto);
    }
  }

  const diffWarnings = [];
  if (session && previousSession) {
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

  if (!session || !event || !fridge) return <div className="page">Lädt...</div>;

  return (
    <div className="page">
      {isTeamRoute ? (
        <button className="btn-link back-link" onClick={() => navigate(-1)}>← Zurück</button>
      ) : (
        <Link to={`/event/${event.id}`} className="back-link">← Zurück zur Veranstaltung</Link>
      )}
      <h1>
        {fridge.label} — {session.label}
      </h1>
      <p className="muted">
        {event.name} — {formatDateTime(session.timestamp)}
      </p>

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

      {/* Vergleichsfoto aus letzter Zählung */}
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

      {/* Aktuelles Foto */}
      <div className="card">
        <h2>Foto dieser Zählung</h2>
        {showPhotoPrompt && photos.length === 0 && (
          <p className="muted">Foto vom Kühlgerät machen zur Dokumentation?</p>
        )}
        {photos.map((p) => (
          <img key={p.id} src={p.url} alt="Zählfoto" style={{ width: '100%', borderRadius: 8, marginBottom: '0.5rem' }} />
        ))}
        <label className="btn-secondary" style={{ display: 'inline-block', cursor: 'pointer' }}>
          {photoUploading ? 'Hochladen...' : photos.length > 0 ? 'Weiteres Foto' : 'Foto aufnehmen'}
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

      <div className="card">
        <h2>Drucken</h2>
        {!isWebBluetoothSupported() && (
          <p className="muted">
            Web Bluetooth wird von diesem Browser nicht unterstützt. Bitte Chrome verwenden.
          </p>
        )}
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
    </div>
  );
}
