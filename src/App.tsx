import { Link, Route, Routes } from 'react-router-dom';
import Auth from './pages/Auth';
import Kiosk from './pages/Kiosk';

function Home() {
  return (
    <div className="page">
      <h1>Resistance Arcade V2</h1>
      <p className="muted">Coinbase Commerce + webhook-driven credit fulfillment (dev skeleton).</p>
      <div className="card">
        <ul>
          <li>
            <Link to="/kiosk">Go to the Coin Machine</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/kiosk" element={<Kiosk />} />
      <Route
        path="*"
        element={
          <div className="page">
            <h2>Not Found</h2>
            <Link to="/">Home</Link>
          </div>
        }
      />
    </Routes>
  );
}
