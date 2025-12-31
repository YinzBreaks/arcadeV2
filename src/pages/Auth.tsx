import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [signingIn, setSigningIn] = React.useState(false);

  React.useEffect(() => {
    // Check if already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/kiosk', { replace: true });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (handles OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/kiosk', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleGoogleSignIn() {
    setError(null);
    setSigningIn(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/kiosk`,
        },
      });
      if (signInError) {
        setError(signInError.message);
        setSigningIn(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
      setSigningIn(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <h2>Loading...</h2>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Sign In</h2>
      <p className="muted">Sign in to access the Coin Machine and purchase credits.</p>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <button className="btn btn-google" onClick={handleGoogleSignIn} disabled={signingIn}>
          {signingIn ? 'Redirecting...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}
