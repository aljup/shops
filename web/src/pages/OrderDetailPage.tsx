import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PAYMENT_LABEL, STATUS_LABEL, api, money } from '../api';
import type { Order } from '../api';
import { EmptyState, Spinner, useToast } from '../ui';

const STEPS = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED'] as const;

export default function OrderDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setOrder(await api<Order>(`/orders/${id}`));
    } catch {
      setError('لم نجد هذا الطلب أو لا تملك صلاحية عرضه.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async () => {
    if (!order) return;
    const reason = window.prompt('سبب الإلغاء (اختياري):', 'طلب العميل') ?? undefined;
    if (reason === undefined) return;
    setBusy(true);
    try {
      setOrder(
        await api<Order>(`/orders/${order.id}/cancel`, {
          method: 'POST',
          body: { reason },
        }),
      );
      toast.push('أُلغي الطلب');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'تعذّر الإلغاء', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="جارٍ تحميل الطلب…" />;
  if (error || !order)
    return (
      <EmptyState
        title="الطلب غير متاح"
        hint={error ?? undefined}
        action={
          <Link className="btn" to="/orders">
            كل الطلبات
          </Link>
        }
      />
    );

  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const cancellable = order.status === 'PENDING' || order.status === 'PAID';

  return (
    <>
      <nav className="breadcrumbs" aria-label="مسار التنقل">
        <Link to="/orders">طلباتي</Link>
        <span>/</span>
        <span>طلب #{order.id.slice(0, 8)}</span>
      </nav>

      <div className="section__head" style={{ marginBlockStart: 14 }}>
        <div>
          <h1 style={{ fontSize: '1.7rem' }}>طلب #{order.id.slice(0, 8)}</h1>
          <p className="muted small">
            أُنشئ في{' '}
            {new Date(order.createdAt).toLocaleString('ar-SA', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <span
          className={`badge ${order.status === 'CANCELLED' ? 'badge--danger' : 'badge--warn'}`}
        >
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className="cart-layout">
        <div className="stack">
          <section className="panel">
            <h2 style={{ fontSize: '1.05rem', marginBlockEnd: 12 }}>المنتجات</h2>
            {order.items.map((item) => (
              <div className="summary-row" key={item.id}>
                <span>
                  {item.productName} × {item.quantity}
                </span>
                <span>{money(item.lineTotal, order.currency)}</span>
              </div>
            ))}
            <div className="summary-row summary-row--total">
              <span>الإجمالي</span>
              <span>{money(order.total, order.currency)}</span>
            </div>
          </section>

          <section className="panel">
            <h2 style={{ fontSize: '1.05rem', marginBlockEnd: 12 }}>حالة الطلب</h2>
            {order.status === 'CANCELLED' ? (
              <p className="muted small">
                أُلغي هذا الطلب{order.cancelReason ? ` — السبب: ${order.cancelReason}` : ''}.
              </p>
            ) : (
              <ul className="timeline">
                {STEPS.map((step, index) => (
                  <li key={step} className={index <= stepIndex ? 'done' : ''}>
                    {index <= stepIndex ? '●' : '○'} {STATUS_LABEL[step]}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="panel summary-card">
          <h2 style={{ fontSize: '1.15rem', marginBlockEnd: 12 }}>تفاصيل الدفع</h2>
          <div className="summary-row">
            <span>طريقة الدفع</span>
            <span>{order.paymentMethod === 'cod' ? 'عند الاستلام' : 'تحويل يدوي'}</span>
          </div>
          <div className="summary-row">
            <span>حالة الدفع</span>
            <span>{PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}</span>
          </div>
          <div className="summary-row">
            <span>المجموع الفرعي</span>
            <span>{money(order.subtotal, order.currency)}</span>
          </div>
          <div className="summary-row summary-row--total">
            <span>الإجمالي</span>
            <span>{money(order.total, order.currency)}</span>
          </div>
          {cancellable ? (
            <button
              type="button"
              className="btn btn--danger btn--block"
              style={{ marginBlockStart: 16 }}
              onClick={() => void cancel()}
              disabled={busy}
            >
              {busy ? 'جارٍ الإلغاء…' : 'إلغاء الطلب'}
            </button>
          ) : null}
          <Link className="btn btn--ghost btn--block" to="/products" style={{ marginBlockStart: 10 }}>
            تسوّق مرة أخرى
          </Link>
        </aside>
      </div>
    </>
  );
}
