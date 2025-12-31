import type { Session } from '@supabase/supabase-js';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RUNTIME } from '../config/runtime';
import { supabase } from '../lib/supabase';

interface Game {
  id: string;
  title: string;
  description: string;
}

const GAMES: Game[] = [
  { id: 'flappy', title: 'Flappy Clone', description: 'Tap to fly through pipes.' },
  { id: 'snake', title: 'Snake', description: 'Classic snake game.' },
  { id: 'breakout', title: 'Breakout', description: 'Break all the bricks!' },
];

export default function Arcade() {
  const navigate = useNavigate();
  const [session, setSession] = React.useState<Session | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [busyGame, setBusyGame] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
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

  async function startGame(gameId: string) {
    if (!session?.access_token) return;
    setError(null);
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
          setError('Not enough credits. Buy more at the Coin Machine!');
        } else if (data.error === 'ACTIVE_SESSION_EXISTS') {
          setError('You are already playing a game.');
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

  if (authLoading) {
    return (
      <div className="page">
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const hasPass = wallet?.passExpiresAt && new Date(wallet.passExpiresAt) > new Date();

  return (
    <div className="page">
      <h2>Arcade</h2>
      <p className="muted">Choose a game to play.</p>

      <div className="card">
        <div>
          <strong>Credits:</strong> {wallet ? wallet.credits : '...'}
        </div>
        <div>
          <strong>Pass:</strong> {hasPass ? 'Active' : 'None'}
        </div>
        <Link to="/kiosk" className="btn" style={{ display: 'inline-block', marginTop: '8px' }}>
          Buy Credits
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        {GAMES.map((g) => (
          <div className="tile" key={g.id}>
            <h3>{g.title}</h3>
            <p className="muted">{g.description}</p>
            <button
              className="btn"
              onClick={() => startGame(g.id)}
              disabled={busyGame !== null}
            >
              {busyGame === g.id ? 'Starting...' : 'Play (1 Credit)'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
