import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Products from './pages/Products';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Counting from './pages/Counting';
import Summary from './pages/Summary';
import Correction from './pages/Correction';

function Nav() {
  const location = useLocation();
  const isCounting = location.pathname.startsWith('/count/');
  if (isCounting) return null; // beim Zählen keine Navigation, volle Konzentration
  return (
    <nav className="nav">
      <Link to="/events">Veranstaltungen</Link>
      <Link to="/products">Produkte</Link>
    </nav>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Nav />
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
