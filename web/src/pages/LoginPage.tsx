import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { useAuth } from '../store';
import { Field } from '../ui';

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (user) {
    return (
      <div className="auth-card panel">
        <h1 style={{ fontSize: '1.3rem' }}>أنت مسجّل الدخول</h1>
        <p className="muted small" style={{ marginBlock: '10px 16px' }}>
          مرحباً {user.name}
        </p>
        <Link className="btn btn--block" to={from}>
          متابعة
        </Link>
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await signIn(email.trim(), password);
      navigate(me.role === 'ADMIN' ? '/admin' : from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-card panel form" onSubmit={(event) => void submit(event)}>
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBlockEnd: 6 }}>تسجيل الدخول</h1>
        <p className="muted small">أدخل بياناتك لمتابعة التسوّق وإدارة طلباتك.</p>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <Field label="البريد الإلكتروني">
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Field>
      <Field label="كلمة المرور">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </Field>
      <button type="submit" className="btn btn--block" disabled={busy}>
        {busy ? 'جارٍ الدخول…' : 'دخول'}
      </button>
      <p className="muted small" style={{ textAlign: 'center' }}>
        ليس لديك حساب؟ <Link to="/register" style={{ color: 'var(--brand)', fontWeight: 700 }}>أنشئ حساباً</Link>
      </p>
    </form>
  );
}
