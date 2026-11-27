import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api';
import type { Product } from '../api';
import { useAuth, useCart } from '../store';
import { EmptyState, ProductArt, Spinner, useToast } from '../ui';

export default function ProductPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api<Product>(`/products/${slug}`)
      .then(setProduct)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner />;
  if (notFound || !product)
    return (
      <EmptyState
        title="لم نجد هذا المنتج"
        hint="ربما انتهى أو تغيّر رابطه."
        action={
          <Link className="btn" to="/products">
            العودة للمنتجات
          </Link>
        }
      />
    );

  const outOfStock = product.stock <= 0;

  const add = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    try {
      await addItem(product.id, quantity);
      toast.push('أُضيف إلى السلة');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر الإضافة', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <nav className="breadcrumbs" aria-label="مسار التنقل">
        <Link to="/">الرئيسية</Link>
        <span>/</span>
        <Link to="/products">المنتجات</Link>
        {product.category ? (
          <>
            <span>/</span>
            <Link to={`/products?cat=${product.category.slug}`}>{product.category.name}</Link>
          </>
        ) : null}
      </nav>

      <div className="detail">
        <ProductArt name={product.name} image={product.images?.[0]?.url ?? null} />
        <div>
          <span className="badge">{product.category?.name ?? 'منتجات'}</span>
          <h1>{product.name}</h1>
          <div className="row small muted">
            <span>رقم المنتج: {product.id.slice(0, 8)}</span>
            {outOfStock ? (
              <span className="badge badge--danger">نفدت الكمية</span>
            ) : (
              <span className="badge badge--warn">{product.stock} قطعة متوفرة</span>
            )}
          </div>
          <div className="detail__price">{money(product.price, product.currency)}</div>
          <p className="detail__desc">{product.description}</p>

          <div className="row" style={{ gap: 14, marginBlockEnd: 22 }}>
            <div className="qty" aria-label="الكمية">
              <button type="button" onClick={() => setQuantity((v) => Math.max(1, v - 1))} aria-label="تقليل">
                −
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((v) => Math.min(product.stock || 1, v + 1))}
                aria-label="زيادة"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => void add()}
              disabled={busy || outOfStock}
              style={{ minWidth: 200 }}
            >
              {busy ? 'جارٍ الإضافة…' : outOfStock ? 'غير متوفر' : 'أضف إلى السلة'}
            </button>
            <Link to="/cart" className="btn btn--ghost">
              عرض السلة
            </Link>
          </div>

          <div className="panel">
            <div className="stack" style={{ gap: 10 }}>
              <div className="row between small">
                <span className="muted">طريقة الدفع</span>
                <strong>الدفع عند الاستلام</strong>
              </div>
              <div className="row between small">
                <span className="muted">مدة التوصيل</span>
                <strong>2–4 أيام عمل</strong>
              </div>
              <div className="row between small">
                <span className="muted">الإرجاع</span>
                <strong>خلال 30 يوماً</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
