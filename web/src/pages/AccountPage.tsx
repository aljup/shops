import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_LABEL, api, money } from '../api';
import type { Order, Page } from '../api';
import { useAuth, useCart } from '../store';
import { Spinner } from '../ui';

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const { cart } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Page<Order>>('/orders?limit=3')
      .then((page) => setOrders(page.data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const spend = orders.filter((o) => o.status !== 'CANCELLED').reduce((sum, o) => sum + o.total, 0);

  return (
    <>
      <div className="account-head">
        <div className="avatar" aria-hidden>
          {user.name.trim().slice(0, 1)}
        </div>
        <div className="account-head__meta">
          <h1 style={{ fontSize: '1.6rem' }}>{user.name}</h1>
          <div className="row small muted" style={{ gap: 10 }}>
            <span dir="ltr">{user.email}</span>
            <span className={`badge ${user.role === 'ADMIN' ? 'badge--warn' : ''}`}>
              {user.role === 'ADMIN' ? 'مدير المتجر' : 'عميل'}
            </span>
          </div>
        </div>
        <div className="row" style={{ marginInlineStart: 'auto', gap: 10 }}>
          <Link className="btn btn--ghost btn--sm" to="/orders">
            طلباتي
          </Link>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => void signOut()}>
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="panel stat">
          <span className="muted small">الطلبات الأخيرة</span>
          <strong>{loading ? '…' : orders.length}</strong>
        </div>
        <div className="panel stat">
          <span className="muted small">قيمة المشتريات</span>
          <strong>{money(spend, orders[0]?.currency ?? 'SAR')}</strong>
        </div>
        <div className="panel stat">
          <span className="muted small">في السلة الآن</span>
          <strong>{cart?.summary.itemCount ?? 0}</strong>
        </div>
        <div className="panel stat">
          <span className="muted small">حالة الحساب</span>
          <strong style={{ fontSize: '1.05rem', color: 'var(--ok)' }}>نشط</strong>
        </div>
      </div>

      <div className="cart-layout" style={{ marginBlockStart: 8 }}>
        <section className="panel">
          <div className="row between" style={{ marginBlockEnd: 12 }}>
            <h2 style={{ fontSize: '1.1rem' }}>آخر الطلبات</h2>
            <Link to="/orders" className="small" style={{ color: 'var(--brand)', fontWeight: 700 }}>
              عرض الكل
            </Link>
          </div>
          {loading ? (
            <Spinner />
          ) : orders.length === 0 ? (
            <p className="muted small">لا توجد طلبات بعد.</p>
          ) : (
            <div className="stack" style={{ gap: 0 }}>
              {orders.map((order) => (
                <Link className="account-order" to={`/orders/${order.id}`} key={order.id}>
                  <div>
                    <strong>طلب #{order.id.slice(0, 8)}</strong>
                    <div className="muted small">
                      {new Date(order.createdAt).toLocaleDateString('ar-SA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <span className={`badge ${order.status === 'CANCELLED' ? 'badge--danger' : 'badge--warn'}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                  <strong>{money(order.total, order.currency)}</strong>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="panel stack">
          <h2 style={{ fontSize: '1.1rem' }}>روابط سريعة</h2>
          <Link className="btn btn--ghost btn--block" to="/cart">
            سلة المشتريات
          </Link>
          <Link className="btn btn--ghost btn--block" to="/orders">
            كل طلباتي
          </Link>
          <Link className="btn btn--ghost btn--block" to="/products">
            متابعة التسوّق
          </Link>
          {user.role === 'ADMIN' ? (
            <Link className="btn btn--block" to="/admin">
              لوحة الإدارة
            </Link>
          ) : null}
        </aside>
      </div>
      <div style={{ height: 40 }} />
    </>
  );
}
