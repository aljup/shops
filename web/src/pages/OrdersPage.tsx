import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_LABEL, api, money } from '../api';
import type { Order, Page } from '../api';
import { EmptyState, Spinner } from '../ui';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Page<Order>>('/orders?limit=20')
      .then((page) => setOrders(page.data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="جارٍ تحميل طلباتك…" />;

  return (
    <>
      <div className="section__head" style={{ marginBlockStart: 26 }}>
        <div>
          <h1 style={{ fontSize: '1.7rem' }}>طلباتي</h1>
          <p>{orders.length} طلب</p>
        </div>
        <Link className="btn btn--ghost btn--sm" to="/products">
          تسوّق المزيد
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات بعد"
          hint="عند إتمام أول طلب سيظهر هنا مع حالته."
          action={
            <Link className="btn" to="/products">
              ابدأ التسوّق
            </Link>
          }
        />
      ) : (
        <div className="stack">
          {orders.map((order) => (
            <Link className="panel order-card" to={`/orders/${order.id}`} key={order.id}>
              <div className="order-card__head">
                <div>
                  <strong>طلب #{order.id.slice(0, 8)}</strong>
                  <div className="muted small">
                    {new Date(order.createdAt).toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <span
                  className={`badge ${
                    order.status === 'CANCELLED'
                      ? 'badge--danger'
                      : order.status === 'DELIVERED'
                        ? ''
                        : 'badge--warn'
                  }`}
                >
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
              <div className="row between small muted">
                <span>
                  {order.items.length} منتج · {order.items.reduce((sum, item) => sum + item.quantity, 0)} قطعة
                </span>
                <strong style={{ color: 'var(--ink)' }}>{money(order.total, order.currency)}</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div style={{ height: 40 }} />
    </>
  );
}
