import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RUNTIME } from '../config/runtime';
import { addAuthHeaders, isDevAuthBypassEnabled } from '../lib/devAuth';
import { supabase } from '../lib/supabase';

interface VerifyResponse {
  ok: boolean;
  gameId?: string;
  mode?: string;
  expiresAt?: string;
  error?: string;
}

interface GameOverMessage {
  type: 'GAME_OVER';
  gameId: string;
  reason: 'completed' | 'quit';
}

function isValidGameOverMessage(data: unknown): data is GameOverMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.type === 'GAME_OVER' &&
    typeof msg.gameId === 'string' &&
    (msg.reason === 'completed' || msg.reason === 'quit')
  );
}

export default function Play() {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [verified, setVerified] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [gameEnded, setGameEnded] = React.useState(false);
  const [sceneReady, setSceneReady] = React.useState(false);

  const token = searchParams.get('token');

  // Trigger entrance animation after mount
  React.useEffect(() => {
    const timer = requestAnimationFrame(() => setSceneReady(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Verify play token on mount
  React.useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError('No play token provided.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${RUNTIME.apiBaseUrl}/play/verify?token=${encodeURIComponent(token)}`,
        );
        const data: VerifyResponse = await res.json();

        if (!data.ok) {
          if (data.error === 'TOKEN_EXPIRED') {
            setError('Your play session has expired.');
          } else if (data.error === 'INVALID_TOKEN') {
            setError('Invalid play token.');
          } else {
            setError(data.error || 'Verification failed.');
          }
          setLoading(false);
          return;
        }

        // Verify the token is for the correct game
        if (data.gameId !== gameId) {
          setError('Token does not match this game.');
          setLoading(false);
          return;
        }

        setVerified(true);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Verification failed.');
        setLoading(false);
      }
    }

    verifyToken();
  }, [token, gameId]);

  // Listen for GAME_OVER postMessage from iframe
  React.useEffect(() => {
    if (!verified || !token || !gameId) return;

    async function handleMessage(event: MessageEvent) {
      // Security: Only accept same-origin messages
      if (event.origin !== window.location.origin) {
        return;
      }

      // Validate message shape
      if (!isValidGameOverMessage(event.data)) {
        return;
      }

      // Validate gameId matches route param
      if (event.data.gameId !== gameId) {
        return;
      }

      // Prevent duplicate handling
      if (gameEnded) return;
      setGameEnded(true);

      // Optionally request early session end from server
      // This is a coordination signal, not authoritative - TTL remains fallback
      try {
        let accessToken: string | undefined;
        if (!isDevAuthBypassEnabled()) {
          const { data: sessionData } = await supabase.auth.getSession();
          accessToken = sessionData?.session?.access_token;
        }

        if (token && (accessToken || isDevAuthBypassEnabled())) {
          await fetch(`${RUNTIME.apiBaseUrl}/play/end`, {
            method: 'POST',
            headers: addAuthHeaders({ 'Content-Type': 'application/json' }, accessToken),
            body: JSON.stringify({ playToken: token }),
          });
          // Response is intentionally ignored - this is optional coordination
          // TTL-based expiration remains the authoritative mechanism
        }
      } catch {
        // Silently ignore - early end is optional, TTL handles expiration
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [verified, token, gameId, gameEnded]);

  if (loading) {
    return (
      <div
        className={`page play-page-transition${sceneReady ? ' play-page-transition--entered' : ''}`}
      >
        <h2>Verifying...</h2>
        <p className="muted">Checking your play token...</p>
      </div>
    );
  }

  if (error || !verified) {
    return (
      <div
        className={`page play-page-transition${sceneReady ? ' play-page-transition--entered' : ''}`}
      >
        <h2>Cannot Play</h2>
        {error && <div className="error">{error}</div>}
        <button className="btn" onClick={() => navigate('/arcade')} style={{ marginTop: '16px' }}>
          Back to Arcade
        </button>
      </div>
    );
  }

  // Game ended - show thanks screen and navigate back
  if (gameEnded) {
    return (
      <div className="page play-page-ended">
        <div className="play-ended-glow" />
        <h2>Thanks for Playing!</h2>
        <p className="muted">Your session has ended.</p>
        <button className="btn" onClick={() => navigate('/arcade')} style={{ marginTop: '16px' }}>
          Back to Arcade
        </button>
      </div>
    );
  }

  // Token verified - render the game iframe
  // Note: playToken is NOT passed to iframe - games have no authority over sessions
  const gameUrl = `/games/${gameId}/index.html`;

  return (
    <div className={`page play-page${sceneReady ? ' play-page--entered' : ''}`}>
      <div className="play-header">
        <h2>Now Playing: {gameId}</h2>
        <button className="btn btn-signout" onClick={() => navigate('/arcade')}>
          Exit Game
        </button>
      </div>
      <div className="game-container">
        <iframe
          src={gameUrl}
          title={`Game: ${gameId}`}
          className="game-iframe"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
