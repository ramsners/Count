// src/App.jsx
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Products from './pages/Products';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Counting from './pages/Counting';
import Summary from './pages/Summary';
import Correction from './pages/Correction';
import Login from './pages/Login';
import { getCurrentUser, onAuthChange, signOut } from './lib/auth';

function Nav({ user }) {
  const location = useLocation();
  const isCounting =
    location.pathname.startsWith('/count/') ||
    location.pathname.startsWith('/correct/');
  if (isCounting) return null;
  return (
    <nav className="nav">
      <Link to="/events">Veranstaltungen</Link>
      <Link to="/products">Produkte</Link>
      <button className="btn-link" onClick={signOut} style={{ marginLeft: 'auto' }}>
        Abmelden
      </button>
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = noch laden

  useEffect(() => {
    getCurrentUser().then(setUser);
    const unsub = onAuthChange(setUser);
    return unsub;
  }, []);

  if (user === undefined) return <div className="page">Lädt...</div>;

  if (!user) return <Login onLogin={() => getCurrentUser().then(setUser)} />;

  return (
    <HashRouter>
      <Nav user={user} />
      <Routes>
        <Route path="/" element={<Events />} />
        <Route path="/events" element={<Events />} />
        <Route path="/products" element={<Products />} />
        <Route path="/event/:eventId" element={<EventDetail />} />
        <Route path="/count/:fridgeId" element={<Counting />} />
        <Route path="/summary/:sessionId" element={<Summary />} />
        <Route path="/correct/:sessionId/:productId" element={<Correction />} />
      </Routes>
    </HashRouter>
  );
}
