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

  // On mount, check if we have a recovery session
  React.useEffect(() => {
    // Supabase handles the recovery token from the URL automatically
    // and creates a session when the page loads
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
      }
      setChecking(false);
    });

    // Listen for auth state changes (recovery token processing)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    return () => subscription.unsubscribe();
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
        setTimeout(() => {
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
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <button
            className="btn auth-btn-full auth-btn-primary"
            onClick={() => navigate('/auth', { replace: true })}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="page auth-page">
        <div className="auth-container">
          <h2 className="auth-title">Password Updated</h2>
          <div className="auth-success">
            Your password has been successfully updated. Redirecting...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-container">
        <h2 className="auth-title">Set New Password</h2>
        <p className="muted auth-subtitle">
          Enter your new password below. It must be at least {MIN_PASSWORD_LENGTH} characters.
        </p>

        {error && <div className="error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              placeholder="Re-enter new password"
            />
          </div>

          <button
            type="submit"
            className="btn auth-btn-full auth-btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div className="auth-links">
          <button
            type="button"
            className="auth-link"
            onClick={() => navigate('/auth', { replace: true })}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
