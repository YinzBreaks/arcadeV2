import type { Session } from '@supabase/supabase-js';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ArcadeMachine, { type MachineStatus } from '../components/ArcadeMachine';
import { RUNTIME } from '../config/runtime';
import { addAuthHeaders, isDevAuthBypassEnabled } from '../lib/devAuth';
import { supabase } from '../lib/supabase';

interface Game {
  id: string;
  title: string;
  description: string;
}

// Game catalog - arranged in rows for the floor layout
const GAMES: Game[] = [
  { id: 'flappy', title: 'FLAPPY', description: 'Tap to fly through pipes.' },
  { id: 'snake', title: 'SNAKE', description: 'Classic snake game.' },
  { id: 'breakout', title: 'BREAKOUT', description: 'Break all the bricks!' },
  { id: 'pong', title: 'PONG', description: 'Classic paddle game.' },
  { id: 'asteroids', title: 'ASTEROIDS', description: 'Shoot space rocks.' },
  { id: 'pacman', title: 'PAC-MAN', description: 'Eat dots, avoid ghosts.' },
];

// Arrange games into rows for spatial layout
const ARCADE_ROWS = [
  GAMES.slice(0, 3), // Row 1: first 3 machines
  GAMES.slice(3, 6), // Row 2: next 3 machines
];

export default function Arcade() {
  const navigate = useNavigate();
  const [session, setSession] = React.useState<Session | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [busyGame, setBusyGame] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lockedReason, setLockedReason] = React.useState<string | null>(null);
  const [wallet, setWallet] = React.useState<{
    credits: number;
    passExpiresAt: string | null;
  } | null>(null);
  const [sceneReady, setSceneReady] = React.useState(false);
  const [prizeToast, setPrizeToast] = React.useState(false);

  // Trigger entrance animation after mount
  React.useEffect(() => {
    const timer = requestAnimationFrame(() => setSceneReady(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  React.useEffect(() => {
    // Dev bypass: skip Supabase auth check
    if (isDevAuthBypassEnabled()) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
      if (!s) {
        navigate('/auth', { replace: true });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        navigate('/auth', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const refreshWallet = React.useCallback(async () => {
    try {
      const res = await fetch(`${RUNTIME.apiBaseUrl}/wallet/me`, {
        headers: addAuthHeaders({}, session?.access_token),
      });
      const data = await res.json();
      if (res.ok && data.ok) setWallet(data.wallet);
    } catch {
      // ignore
    }
  }, [session?.access_token]);

  React.useEffect(() => {
    if (session?.access_token || isDevAuthBypassEnabled()) {
      refreshWallet();
    }
  }, [session?.access_token, refreshWallet]);

  // Clear error after timeout
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Clear prize toast after timeout
  React.useEffect(() => {
    if (prizeToast) {
      const timer = setTimeout(() => setPrizeToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [prizeToast]);

  function handlePrizeCounter() {
    setPrizeToast(true);
  }

  async function startGame(gameId: string) {
    setError(null);
    setLockedReason(null);
    setBusyGame(gameId);

    try {
      const res = await fetch(`${RUNTIME.apiBaseUrl}/play/start`, {
        method: 'POST',
        headers: addAuthHeaders({ 'Content-Type': 'application/json' }, session?.access_token),
        body: JSON.stringify({ gameId }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        playToken?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.playToken) {
        if (data.error === 'INSUFFICIENT_CREDITS') {
          setError('Not enough credits!');
          setLockedReason('credits');
        } else if (data.error === 'ACTIVE_SESSION_EXISTS') {
          setError('You are already playing a game.');
          setLockedReason('session');
        } else {
          setError(data.error || `Request failed (${res.status})`);
        }
        setBusyGame(null);
        return;
      }

      // Navigate to play gate with token
      navigate(`/play/${encodeURIComponent(gameId)}?token=${encodeURIComponent(data.playToken)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setBusyGame(null);
    }
  }

  function getMachineStatus(gameId: string): MachineStatus {
    if (busyGame === gameId) return 'busy';
    if (busyGame !== null) return 'locked'; // Another game is starting
    if (lockedReason === 'session') return 'locked'; // Active session elsewhere
    return 'available';
  }

  if (authLoading) {
    return (
      <div className="arcade-room">
        <div className="room-back-wall" />
        <div className="room-floor" />
        <div className="arcade-loading">
          <div className="arcade-loading-text">LOADING...</div>
        </div>
      </div>
    );
  }

  if (!session && !isDevAuthBypassEnabled()) {
    return null;
  }

  const hasPass = wallet?.passExpiresAt && new Date(wallet.passExpiresAt) > new Date();

  return (
    <div className={`arcade-room${sceneReady ? ' arcade-room--entered' : ''}`}>
      {/* Room structure */}
      <div className="room-back-wall">
        {/* Wall trim stripe */}
        <div className="wall-trim" />
        {/* Decorative posters/panels */}
        <div className="wall-poster wall-poster--1" />
        <div className="wall-poster wall-poster--2" />
        <div className="wall-poster wall-poster--3" />
        {/* Doorway warm light spill */}
        <div className="wall-door-glow" />
      </div>
      <div className="room-floor" />
      <div className="room-vignette" />
      {/* Film grain overlay */}
      <div className="room-grain" />

      {/* Neon sign on back wall */}
      <header className="arcade-header">
        <h1 className="arcade-title">RESISTANCE ARCADE</h1>
        <div className="arcade-subtitle">INSERT COIN TO PLAY</div>
      </header>

      {/* Status bar - marquee counter strip */}
      <div className="arcade-status-bar">
        <div className="status-item">
          <span className="status-label">CREDITS</span>
          <span className="status-value">{wallet ? wallet.credits : '...'}</span>
        </div>
        <div className="status-item">
          <span className="status-label">PASS</span>
          <span className={`status-value ${hasPass ? 'status-value--active' : ''}`}>
            {hasPass ? 'ACTIVE' : 'NONE'}
          </span>
        </div>
        <Link to="/kiosk" className="arcade-coin-btn">
          🪙 BUY CREDITS
        </Link>
      </div>

      {/* Error toast */}
      {error && (
        <div className="arcade-toast">
          <span className="arcade-toast-icon">⚠️</span>
          <span>{error}</span>
          {lockedReason === 'credits' && (
            <Link to="/kiosk" className="arcade-toast-link">
              Get Credits →
            </Link>
          )}
        </div>
      )}

      {/* Prize counter toast */}
      {prizeToast && (
        <div className="arcade-toast arcade-toast--info">
          <span className="arcade-toast-icon">🎁</span>
          <span>Prize redemption coming soon!</span>
        </div>
      )}

      {/* Room floor with machines */}
      <div className="arcade-floor-area">
        {/* Back wall doorway hint */}
        <div className="arcade-doorway">
          <div className="doorway-frame doorway-frame--left" />
          <div className="doorway-sign">EXIT</div>
          <div className="doorway-frame doorway-frame--right" />
        </div>

        {/* Coin Machine fixture - near entrance */}
        <button
          className="fixture coin-machine"
          onClick={() => navigate('/kiosk')}
          aria-label="Buy tokens at the coin machine"
        >
          <div className="fixture-body">
            <div className="fixture-marquee">CHANGE</div>
            <div className="coin-machine-display">
              <span className="coin-machine-icon">🪙</span>
            </div>
            <div className="coin-machine-slot" />
            <div className="coin-machine-dispenser" />
          </div>
          <div className="fixture-floor-light" />
        </button>

        {/* Machine rows on floor */}
        {ARCADE_ROWS.map((row, rowIndex) => (
          <div className="arcade-row" key={rowIndex} data-row={rowIndex}>
            {row.map((game) => (
              <ArcadeMachine
                key={game.id}
                gameId={game.id}
                title={game.title}
                status={getMachineStatus(game.id)}
                onClick={() => startGame(game.id)}
              />
            ))}
          </div>
        ))}

        {/* Prize Counter fixture - bottom right corner */}
        <button
          className="fixture prize-counter"
          onClick={handlePrizeCounter}
          aria-label="Prize counter - coming soon"
        >
          <div className="fixture-body">
            <div className="fixture-marquee">PRIZES</div>
            <div className="prize-counter-display">
              <div className="prize-shelf prize-shelf--1">
                <span className="prize-item">🧸</span>
                <span className="prize-item">🎮</span>
              </div>
              <div className="prize-shelf prize-shelf--2">
                <span className="prize-item">🎪</span>
                <span className="prize-item">⭐</span>
              </div>
            </div>
            <div className="prize-counter-window" />
          </div>
          <div className="fixture-floor-light fixture-floor-light--warm" />
        </button>
      </div>

      {/* Ambient floor reflections */}
      <div className="room-floor-reflections" />
    </div>
  );
}
