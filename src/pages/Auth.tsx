import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type AuthMode = 'signin' | 'signup' | 'forgot';

// Safe redirect destination (no user-controlled redirects)
const POST_AUTH_REDIRECT = '/arcade';

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [mode, setMode] = React.useState<AuthMode>('signin');

  // Form state
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  // UI state
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Rate limiting state (in-memory, per page load)
  const [failedAttempts, setFailedAttempts] = React.useState(0);
  const [lockoutUntil, setLockoutUntil] = React.useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = React.useState(0);

  // Check if locked out
  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  // Lockout countdown timer
  React.useEffect(() => {
    if (!lockoutUntil) return;

    const interval = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutRemaining(0);
        setFailedAttempts(0);
      } else {
        setLockoutRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Check existing session on mount
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(POST_AUTH_REDIRECT, { replace: true });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (handles OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate(POST_AUTH_REDIRECT, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Reset form when switching modes
  React.useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
  }, [mode]);

  // Record a failed attempt and potentially trigger lockout
  function recordFailedAttempt() {
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);
    if (newCount >= MAX_ATTEMPTS) {
      const lockoutEnd = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockoutUntil(lockoutEnd);
      setLockoutRemaining(LOCKOUT_SECONDS);
    }
  }

  // Google SSO handler
  async function handleGoogleSignIn() {
    if (isLockedOut) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Safe redirect: hardcoded origin + path, no user input
          redirectTo: `${window.location.origin}${POST_AUTH_REDIRECT}`,
        },
      });
      if (signInError) {
        // Generic error - don't expose internal details
        setError('Sign in failed. Please try again.');
        recordFailedAttempt();
        setSubmitting(false);
      }
    } catch {
      setError('Sign in failed. Please try again.');
      recordFailedAttempt();
      setSubmitting(false);
    }
  }

  // Email/password sign in
  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (isLockedOut || submitting) return;

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // SECURITY: Generic message - do not reveal if email exists
        setError('Invalid email or password.');
        recordFailedAttempt();
      }
      // On success, onAuthStateChange will handle redirect
    } catch {
      setError('Invalid email or password.');
      recordFailedAttempt();
    } finally {
      setSubmitting(false);
    }
  }

  // Email/password sign up
  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (isLockedOut || submitting) return;

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Safe redirect for email confirmation link
          emailRedirectTo: `${window.location.origin}${POST_AUTH_REDIRECT}`,
        },
      });

      // SECURITY: Always show generic message regardless of outcome
      // This prevents enumeration of existing accounts
      if (signUpError) {
        // Log category only in dev, without PII
        if (import.meta.env.DEV) {
          console.warn('[Auth] Sign up error category:', signUpError.name);
        }
      }

      // Always show success message - prevents enumeration
      setSuccess(
        "If an account can be created, you'll receive an email shortly. Please check your inbox.",
      );
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch {
      // Still show success to prevent enumeration
      setSuccess(
        "If an account can be created, you'll receive an email shortly. Please check your inbox.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Forgot password request
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (isLockedOut || submitting) return;

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Safe redirect: hardcoded origin + known-safe path
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // SECURITY: Always show generic message regardless of outcome
      if (resetError) {
        if (import.meta.env.DEV) {
          console.warn('[Auth] Reset error category:', resetError.name);
        }
      }

      // Always show success - prevents enumeration
      setSuccess("If an account exists for that email, you'll receive a reset link shortly.");
      setEmail('');
    } catch {
      // Still show success to prevent enumeration
      setSuccess("If an account exists for that email, you'll receive a reset link shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page auth-page">
        <h2>Loading...</h2>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-container">
        <h2 className="auth-title">
          {mode === 'signin' && 'Sign In'}
          {mode === 'signup' && 'Create Account'}
          {mode === 'forgot' && 'Reset Password'}
        </h2>
        <p className="muted auth-subtitle">
          {mode === 'signin' && 'Sign in to access the arcade and purchase credits.'}
          {mode === 'signup' && 'Create an account to start playing.'}
          {mode === 'forgot' && 'Enter your email to receive a password reset link.'}
        </p>

        {/* Lockout warning */}
        {isLockedOut && (
          <div className="auth-lockout">
            Too many attempts. Try again in {lockoutRemaining} seconds.
          </div>
        )}

        {/* Error message (plain text, no HTML rendering) */}
        {error && !isLockedOut && <div className="error">{error}</div>}

        {/* Success message (plain text, no HTML rendering) */}
        {success && <div className="auth-success">{success}</div>}

        {/* SSO buttons (sign in mode only) */}
        {mode === 'signin' && !success && (
          <>
            <div className="auth-sso-buttons">
              <button
                className="btn btn-google auth-btn-full"
                onClick={handleGoogleSignIn}
                disabled={submitting || isLockedOut}
              >
                Continue with Google
              </button>
              <button className="btn auth-btn-full auth-btn-disabled" disabled>
                Continue with Apple (Coming Soon)
              </button>
            </div>

            <div className="auth-divider">
              <span>or</span>
            </div>
          </>
        )}

        {/* Email/password form */}
        {!success && (
          <form
            className="auth-form"
            onSubmit={
              mode === 'signin'
                ? handleEmailSignIn
                : mode === 'signup'
                  ? handleEmailSignUp
                  : handleForgotPassword
            }
          >
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || isLockedOut}
                placeholder="you@example.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting || isLockedOut}
                  placeholder={mode === 'signup' ? 'Minimum 10 characters' : 'Enter password'}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="auth-field">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting || isLockedOut}
                  placeholder="Re-enter password"
                />
              </div>
            )}

            <button
              type="submit"
              className="btn auth-btn-full auth-btn-primary"
              disabled={submitting || isLockedOut}
            >
              {submitting
                ? 'Please wait...'
                : mode === 'signin'
                  ? 'Sign In'
                  : mode === 'signup'
                    ? 'Create Account'
                    : 'Send Reset Link'}
            </button>
          </form>
        )}

        {/* Mode switching links */}
        <div className="auth-links">
          {mode === 'signin' && (
            <>
              <button type="button" className="auth-link" onClick={() => setMode('forgot')}>
                Forgot password?
              </button>
              <span className="auth-link-separator">·</span>
              <button type="button" className="auth-link" onClick={() => setMode('signup')}>
                Create an account
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button type="button" className="auth-link" onClick={() => setMode('signin')}>
              Already have an account? Sign in
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="auth-link" onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
