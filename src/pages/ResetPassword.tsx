import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Safe redirect destination after password reset
const POST_RESET_REDIRECT = '/arcade';

// Minimum password length
const MIN_PASSWORD_LENGTH = 10;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [hasSession, setHasSession] = React.useState(false);

  const redirectTimeoutRef = React.useRef<number | null>(null);

  // On mount, check if we have a recovery session
  React.useEffect(() => {
    let isMounted = true;

    // Supabase may establish the session async after page load,
    // so we do BOTH: an immediate getSession() check AND an auth state listener.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session) {
          setHasSession(true);
        }
        setChecking(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setChecking(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Do not rely on a specific event name (PASSWORD_RECOVERY vs SIGNED_IN etc).
      // If Supabase establishes a session while on this page, we can proceed.
      if (!isMounted) return;
      if (session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    // Validate password length
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        // Generic error message - don't expose internal details
        setError('Failed to update password. Please try again or request a new reset link.');
        if (import.meta.env.DEV) {
          console.warn('[ResetPassword] Update error category:', updateError.name);
        }
      } else {
        setSuccess(true);
        // Auto-redirect after success
        redirectTimeoutRef.current = window.setTimeout(() => {
          navigate(POST_RESET_REDIRECT, { replace: true });
        }, 2000);
      }
    } catch {
      setError('Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="page auth-page">
        <div className="auth-container">
          <h2 className="auth-title">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="page auth-page">
        <div className="auth-container">
          <h2 className="auth-title">Invalid or Expired Link</h2>
          <p className="muted auth-subtitle">
            This password reset link is invalid or has expired. Please request a new reset link.
          </p>
          <button className="btn" onClick={() => navigate('/auth', { replace: true })}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-container">
        <h2 className="auth-title">Reset Password</h2>
        <p className="muted auth-subtitle">Choose a new password for your account.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            New Password
            <input
              className="auth-input"
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting || success}
            />
          </label>

          <label className="auth-label">
            Confirm New Password
            <input
              className="auth-input"
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting || success}
            />
          </label>

          {error && <div className="error">{error}</div>}
          {success && <div className="card">Password updated! Redirecting…</div>}

          <button className="btn" type="submit" disabled={submitting || success}>
            {submitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
