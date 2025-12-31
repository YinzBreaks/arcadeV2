import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RUNTIME } from '../config/runtime';

interface VerifyResponse {
  ok: boolean;
  gameId?: string;
  mode?: string;
  expiresAt?: string;
  error?: string;
}

export default function Play() {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [verified, setVerified] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const token = searchParams.get('token');

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

  if (loading) {
    return (
      <div className="page">
        <h2>Verifying...</h2>
        <p className="muted">Checking your play token...</p>
      </div>
    );
  }

  if (error || !verified) {
    return (
      <div className="page">
        <h2>Cannot Play</h2>
        {error && <div className="error">{error}</div>}
        <button className="btn" onClick={() => navigate('/arcade')} style={{ marginTop: '16px' }}>
          Back to Arcade
        </button>
      </div>
    );
  }

  // Token verified - render the game iframe
  // The iframe URL would be the actual game mini-app
  // For now, we show a placeholder that represents where the game would load
  const gameUrl = `/games/${gameId}/index.html?token=${encodeURIComponent(token || '')}`;

  return (
    <div className="page play-page">
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
