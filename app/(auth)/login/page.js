'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';


function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password. Please check your credentials and try again.');
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-box">
        <div className="auth-company">Pioneer Generation for Commercial Investment</div>
        <div className="auth-divider" />
        <div className="auth-icon"><img src="/api/logo" alt="DocSigner" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
        <h1>DocSigner</h1>
        <p className="auth-sub">Sign in with your account</p>
        <form onSubmit={handleSubmit}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoFocus required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? <span className="spinner" style={{ verticalAlign: 'middle' }} /> : 'Sign In'}
          </button>
          </form>
          <img src="/PGFCI-Logo-Final.png?v=1" alt="PGFCI" className="auth-pgfci-logo" />
          <div className="auth-copyright">Copyright 2026 PGFCI. All rights reserved.</div>
        </div>
      </div>
    );
  }

export default function LoginPage() {
  return (
      <Suspense fallback={
        <div className="auth-gate">
          <div className="auth-box">
            <div className="auth-company">Pioneer Generation for Commercial Investment</div>
            <div className="auth-divider" />
            <div style={{ textAlign: 'center', padding: '20px' }}><span className="spinner" /></div>
            <img src="/PGFCI-Logo-Final.png?v=1" alt="PGFCI" className="auth-pgfci-logo" />
            <div className="auth-copyright">Copyright 2026 PGFCI. All rights reserved.</div>
          </div>
        </div>
      }>
        <LoginForm />
      </Suspense>
  );
}
