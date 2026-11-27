import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../api';
import { useCart } from '../store';
import { EmptyState, ProductArt, Spinner, useToast } from '../ui';

export default function CartPage() {
  const { cart, setQuantity, removeItem, refreshCart, count } = useCart();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!cart) return <Spinner label="جارٍ تحميل السلة…" />;

  const lines = cart.data;

  const change = async (id: string, quantity: number) => {
    if (quantity < 1) return;
    setBusyId(id);
    try {
      await setQuantity(id, quantity);
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر التحديث', 'error');
      await refreshCart();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await removeItem(id);
      toast.push('أُزيل المنتج من السلة');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر الحذف', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (lines.length === 0) {
    return (
      <>
        <div className="section__head" style={{ marginBlockStart: 26 }}>
          <h1 style={{ fontSize: '1.7rem' }}>سلة المشتريات</h1>
        </div>
        <EmptyState
          title="سلتك فارغة"
          hint="أضف منتجات لتبدأ الطلب."
          action={
            <Link className="btn" to="/products">
              تصفّح المنتجات
            </Link>
          }
        />
        <div style={{ height: 40 }} />
      </>
    );
  }

  return (
    <>
      <div className="section__head" style={{ marginBlockStart: 26 }}>
        <div>
          <h1 style={{ fontSize: '1.7rem' }}>سلة المشتريات</h1>
          <p>{count} قطعة في السلة</p>
        </div>
      </div>

      <div className="cart-layout">
        <div className="panel">
          {lines.map((line) => (
            <div className="cart-line" key={line.id}>
              <ProductArt name={line.product.name} image={line.product.image} />
              <div>
                <Link to={`/products/${line.product.slug}`} style={{ fontWeight: 700 }}>
                  {line.product.name}
                </Link>
                <div className="muted small">{money(line.product.price, line.product.currency)} للقطعة</div>
                {line.product.stock < line.quantity ? (
                  <div className="badge badge--danger" style={{ marginBlockStart: 6 }}>
                    المتوفر {line.product.stock} فقط
                  </div>
                ) : null}
              </div>
              <div className="cart-line__actions">
                <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
                  <div className="qty">
                    <button
                      type="button"
                      aria-label="تقليل"
                      disabled={busyId === line.id}
                      onClick={() => void change(line.id, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="زيادة"
                      disabled={busyId === line.id || line.quantity >= line.product.stock}
                      onClick={() => void change(line.id, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <strong>{money(line.lineTotal, line.product.currency)}</strong>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => void remove(line.id)}
                    disabled={busyId === line.id}
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="panel summary-card">
          <h2 style={{ fontSize: '1.15rem', marginBlockEnd: 12 }}>ملخّص الطلب</h2>
          <div className="summary-row">
            <span>عدد القطع</span>
            <span>{cart.summary.itemCount}</span>
          </div>
          <div className="summary-row">
            <span>التوصيل</span>
            <span>مجاني</span>
          </div>
          <div className="summary-row summary-row--total">
            <span>الإجمالي</span>
            <span>{money(cart.summary.subtotal, cart.summary.currency ?? 'SAR')}</span>
          </div>
          <Link className="btn btn--block" to="/checkout" style={{ marginBlockStart: 18 }}>
            متابعة الدفع
          </Link>
          <Link className="btn btn--ghost btn--block" to="/products" style={{ marginBlockStart: 10 }}>
            متابعة التسوّق
          </Link>
        </aside>
      </div>
    </>
  );
}
