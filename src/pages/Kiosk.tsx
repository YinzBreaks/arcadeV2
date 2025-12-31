import type { Session } from '@supabase/supabase-js';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RUNTIME } from '../config/runtime';
import { addAuthHeaders, isDevAuthBypassEnabled } from '../lib/devAuth';
import { supabase } from '../lib/supabase';

type Sku = 'CREDITS_10' | 'CREDITS_50' | 'PASS_60_MIN';

const PACKAGES: Array<{ sku: Sku; title: string; priceUsd: string; description: string }> = [
  {
    sku: 'CREDITS_10',
    title: '10 Credits',
    priceUsd: '5.00',
    description: 'Good for 10 plays (1 credit per game).',
  },
  {
    sku: 'CREDITS_50',
    title: '50 Credits',
    priceUsd: '20.00',
    description: 'Best value for regulars.',
  },
  {
    sku: 'PASS_60_MIN',
    title: 'Play Pass (60 min)',
    priceUsd: '7.00',
    description: 'Unlimited play for 60 minutes.',
  },
];

export default function Kiosk() {
  const navigate = useNavigate();
  const [session, setSession] = React.useState<Session | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [busySku, setBusySku] = React.useState<Sku | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [wallet, setWallet] = React.useState<{
    credits: number;
    passExpiresAt: string | null;
  } | null>(null);

  React.useEffect(() => {
    // Dev bypass: skip Supabase auth check
    if (isDevAuthBypassEnabled()) {
      setAuthLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
      if (!s) {
        navigate('/auth', { replace: true });
      }
    });

    // Listen for auth changes
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

  async function startCheckout(sku: Sku) {
    setError(null);
    setBusySku(sku);
    try {
      const res = await fetch(`${RUNTIME.apiBaseUrl}/commerce/create-charge`, {
        method: 'POST',
        headers: addAuthHeaders(
          { 'Content-Type': 'application/json' },
          session?.access_token,
        ),
        body: JSON.stringify({ sku }),
      });

      const data = (await res.json()) as { ok: boolean; hostedUrl?: string; error?: string };
      if (!res.ok || !data.ok || !data.hostedUrl)
        throw new Error(data.error || `Request failed (${res.status})`);

      window.location.href = data.hostedUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setBusySku(null);
    }
  }

  async function handleSignOut() {
    if (!isDevAuthBypassEnabled()) {
      await supabase.auth.signOut();
    }
  }

  if (authLoading) {
    return (
      <div className="page">
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!session && !isDevAuthBypassEnabled()) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="page">
      <h2>Coin Machine</h2>
      <p className="muted">
        {isDevAuthBypassEnabled()
          ? 'DEV MODE - Auth bypass active'
          : `Signed in as: ${session?.user.email}`}
      </p>

      <div className="card">
        <div>
          <strong>Credits:</strong> {wallet ? wallet.credits : '...'}
        </div>
        <div>
          <strong>Pass:</strong> {wallet?.passExpiresAt ? wallet.passExpiresAt : 'none'}
        </div>
        <button className="btn" onClick={refreshWallet}>
          Refresh balance
        </button>
        <button className="btn btn-signout" style={{ marginLeft: '8px' }} onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        {PACKAGES.map((p) => (
          <div className="tile" key={p.sku}>
            <h3>{p.title}</h3>
            <div className="price">${p.priceUsd} USD</div>
            <p className="muted">{p.description}</p>
            <button
              className="btn"
              onClick={() => startCheckout(p.sku)}
              disabled={busySku !== null}
            >
              {busySku === p.sku ? 'Creating checkout...' : 'Pay with Crypto'}
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Webhook test tip</h3>
        <p className="muted">
          Use a tunnel to expose <code>http://localhost:8788/commerce/webhook</code> to Coinbase,
          then pay a charge. On webhook events, your wallet will be credited idempotently.
        </p>
      </div>
    </div>
  );
}
