import { Link, Route, Routes } from 'react-router-dom';
import Arcade from './pages/Arcade';
import Auth from './pages/Auth';
import Kiosk from './pages/Kiosk';
import Play from './pages/Play';
import ResetPassword from './pages/ResetPassword';

function Home() {
  return (
    <div className="page">
      <h1>Resistance Arcade V2</h1>
      <p className="muted">Coinbase Commerce + webhook-driven credit fulfillment (dev skeleton).</p>
      <div className="card">
        <ul>
          <li>
            <Link to="/arcade">Enter the Arcade</Link>
          </li>
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
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/arcade" element={<Arcade />} />
      <Route path="/kiosk" element={<Kiosk />} />
      <Route path="/play/:gameId" element={<Play />} />
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
