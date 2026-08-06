// src/App.jsx
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Products from './pages/Products';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import DaySummary from './pages/DaySummary';
import Tagesabschluss from './pages/Tagesabschluss';
import Counting from './pages/Counting';
import Summary from './pages/Summary';
import Correction from './pages/Correction';
import Login from './pages/Login';
import TeamAccess from './pages/TeamAccess';
import { getCurrentUser, onAuthChange, signOut } from './lib/auth';

function Nav() {
  const location = useLocation();
  const isCounting =
    location.pathname.startsWith('/count/') ||
    location.pathname.startsWith('/correct/') ||
    location.pathname.startsWith('/team/');
  if (isCounting) return null;
  return (
    <nav className="nav">
      <Link to="/events">Veranstaltungen</Link>
      <Link to="/products">Produkte</Link>
      <button className="btn-link nav-signout" onClick={signOut} style={{ marginLeft: 'auto' }}>
        Abmelden
      </button>
    </nav>
  );
}

function OwnerApp() {
  return (
    <Routes>
      <Route path="/" element={<Events />} />
      <Route path="/events" element={<Events />} />
      <Route path="/products" element={<Products />} />
      <Route path="/event/:eventId" element={<EventDetail />} />
      <Route path="/event/:eventId/day/:dateStr" element={<DaySummary />} />
      <Route path="/event/:eventId/day/:dateStr/abschluss" element={<Tagesabschluss />} />
      <Route path="/count/:fridgeId" element={<Counting />} />
      <Route path="/summary/:sessionId" element={<Summary />} />
      <Route path="/correct/:sessionId/:productId" element={<Correction />} />
    </Routes>
  );
}

function OwnerGate({ user }) {
  if (user === undefined) return <div className="page">Lädt...</div>;
  if (!user) return <Login onLogin={() => getCurrentUser().then(() => {})} />;
  return (
    <>
      <Nav />
      <OwnerApp />
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    getCurrentUser().then(setUser);
    const unsub = onAuthChange(setUser);
    return unsub;
  }, []);

  return (
    <HashRouter>
      <Routes>
        {/* Public team routes — no auth required */}
        <Route path="/team/:code" element={<TeamAccess />} />
        <Route path="/team/:code/count/:fridgeId" element={<Counting />} />
        <Route path="/team/:code/summary/:sessionId" element={<Summary />} />
        <Route path="/team/:code/correct/:sessionId/:productId" element={<Correction />} />

        {/* Owner auth gate */}
        <Route path="*" element={<OwnerGate user={user} />} />
      </Routes>
    </HashRouter>
  );
}
