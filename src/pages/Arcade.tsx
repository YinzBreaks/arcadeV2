import type { Session } from '@supabase/supabase-js';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ArcadeMachine, { type MachineStatus } from '../components/ArcadeMachine';
import { RUNTIME } from '../config/runtime';
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

  React.useEffect(() => {
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
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${RUNTIME.apiBaseUrl}/wallet/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && data.ok) setWallet(data.wallet);
    } catch {
      // ignore
    }
  }, [session?.access_token]);

  React.useEffect(() => {
    if (session?.access_token) {
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

  async function startGame(gameId: string) {
    if (!session?.access_token) return;
    setError(null);
    setLockedReason(null);
    setBusyGame(gameId);

    try {
      const res = await fetch(`${RUNTIME.apiBaseUrl}/play/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
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
      <div className="arcade-floor">
        <div className="arcade-loading">
          <div className="arcade-loading-text">LOADING...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const hasPass = wallet?.passExpiresAt && new Date(wallet.passExpiresAt) > new Date();

  return (
    <div className="arcade-floor">
      {/* Neon sign header */}
      <header className="arcade-header">
        <h1 className="arcade-title">RESISTANCE ARCADE</h1>
        <div className="arcade-subtitle">INSERT COIN TO PLAY</div>
      </header>

      {/* Status bar */}
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

      {/* Arcade floor with machines */}
      <div className="arcade-floor-area">
        {/* Decorative entrance */}
        <div className="arcade-entrance">
          <div className="entrance-door entrance-door--left" />
          <div className="entrance-mat">ENTER</div>
          <div className="entrance-door entrance-door--right" />
        </div>

        {/* Machine rows */}
        {ARCADE_ROWS.map((row, rowIndex) => (
          <div className="arcade-row" key={rowIndex}>
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

        {/* Decorative elements */}
        <div className="arcade-decorations">
          <div className="arcade-deco arcade-deco--prize">
            <span className="deco-icon">🏆</span>
            <span className="deco-label">PRIZES</span>
          </div>
          <div className="arcade-deco arcade-deco--change">
            <span className="deco-icon">💰</span>
            <span className="deco-label">CHANGE</span>
          </div>
        </div>
      </div>

      {/* Floor pattern overlay */}
      <div className="arcade-floor-pattern" />
    </div>
  );
}
