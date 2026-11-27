import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money, newIdempotencyKey } from '../api';
import type { Order } from '../api';
import { useAuth, useCart } from '../store';
import { EmptyState, Spinner, useToast } from '../ui';

export default function CheckoutPage() {
  const { cart, refreshCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<'cod' | 'manual'>('cod');

  if (!cart) return <Spinner label="جارٍ تجهيز الطلب…" />;
  if (cart.data.length === 0) {
    return (
      <EmptyState
        title="لا يوجد ما يمكن دفعه"
        hint="سلتك فارغة حالياً."
        action={
          <Link className="btn" to="/products">
            تصفّح المنتجات
          </Link>
        }
      />
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const order = await api<Order>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        body: {
          items: cart.data.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          paymentMethod: payment,
        },
      });
      await refreshCart();
      toast.push('تم إنشاء طلبك بنجاح');
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنشاء الطلب');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="section__head" style={{ marginBlockStart: 26 }}>
        <div>
          <h1 style={{ fontSize: '1.7rem' }}>إتمام الطلب</h1>
          <p>راجع التفاصيل ثم أكّد الطلب</p>
        </div>
      </div>

      <div className="cart-layout">
        <div className="stack">
          <section className="panel">
            <h2 style={{ fontSize: '1.1rem', marginBlockEnd: 12 }}>بيانات المستلم</h2>
            <div className="stack" style={{ gap: 4 }}>
              <div className="summary-row">
                <span className="muted">الاسم</span>
                <span>{user?.name}</span>
              </div>
              <div className="summary-row">
                <span className="muted">البريد الإلكتروني</span>
                <span dir="ltr">{user?.email}</span>
              </div>
            </div>
            <p className="muted small" style={{ marginBlockStart: 10 }}>
              سيتم التواصل معك على البريد لتأكيد عنوان التوصيل.
            </p>
          </section>

          <section className="panel">
            <h2 style={{ fontSize: '1.1rem', marginBlockEnd: 12 }}>طريقة الدفع</h2>
            <div className="stack" style={{ gap: 10 }}>
              <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payment"
                  checked={payment === 'cod'}
                  onChange={() => setPayment('cod')}
                />
                <span>
                  <strong>الدفع عند الاستلام</strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    ادفع نقداً عند وصول الطلب
                  </span>
                </span>
              </label>
              <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payment"
                  checked={payment === 'manual'}
                  onChange={() => setPayment('manual')}
                />
                <span>
                  <strong>تحويل يدوي</strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    سنرسل لك تفاصيل التحويل بعد التأكيد
                  </span>
                </span>
              </label>
            </div>
          </section>

          {error ? <div className="alert">{error}</div> : null}
        </div>

        <aside className="panel summary-card">
          <h2 style={{ fontSize: '1.15rem', marginBlockEnd: 12 }}>ملخّص الطلب</h2>
          {cart.data.map((line) => (
            <div className="summary-row" key={line.id}>
              <span className="small">
                {line.product.name} × {line.quantity}
              </span>
              <span className="small">{money(line.lineTotal, line.product.currency)}</span>
            </div>
          ))}
          <div className="summary-row summary-row--total">
            <span>الإجمالي</span>
            <span>{money(cart.summary.subtotal, cart.summary.currency ?? 'SAR')}</span>
          </div>
          <button
            type="button"
            className="btn btn--block"
            style={{ marginBlockStart: 18 }}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'جارٍ إنشاء الطلب…' : 'تأكيد الطلب'}
          </button>
          <Link className="btn btn--ghost btn--block" to="/cart" style={{ marginBlockStart: 10 }}>
            تعديل السلة
          </Link>
        </aside>
      </div>
    </>
  );
}
