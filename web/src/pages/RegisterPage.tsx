import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { useAuth } from '../store';
import { Field } from '../ui';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنشاء الحساب');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-card panel form" onSubmit={(event) => void submit(event)}>
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBlockEnd: 6 }}>حساب جديد</h1>
        <p className="muted small">أنشئ حسابك في ثوانٍ وابدأ التسوّق.</p>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <Field label="الاسم الكامل">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          autoComplete="name"
          placeholder="مثال: سارة العتيبي"
        />
      </Field>
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
      <Field label="كلمة المرور" hint="8 أحرف على الأقل، وتشمل حرفاً ورقماً.">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </Field>
      <button type="submit" className="btn btn--block" disabled={busy}>
        {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
      </button>
      <p className="muted small" style={{ textAlign: 'center' }}>
        لديك حساب؟ <Link to="/login" style={{ color: 'var(--brand)', fontWeight: 700 }}>سجّل الدخول</Link>
      </p>
    </form>
  );
}
