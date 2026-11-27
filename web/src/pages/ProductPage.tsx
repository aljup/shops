import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api';
import type { Page, Product } from '../api';
import { useCart } from '../store';
import { EmptyState, ProductArt, ProductCard, Spinner, Stars, useToast } from '../ui';

const TABS = [
  { id: 'desc', label: 'الوصف' },
  { id: 'ship', label: 'الشحن' },
  { id: 'return', label: 'الإرجاع' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ProductPage() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [view, setView] = useState(0);
  const [tab, setTab] = useState<TabId>('desc');
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const buyRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = buyRowRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [product]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    setView(0);
    api<Product>(`/products/${slug}`)
      .then(async (found) => {
        setProduct(found);
        if (found.category) {
          const page = await api<Page<Product>>(
            `/products?categorySlug=${found.category.slug}&limit=5`,
          ).catch(() => null);
          setRelated((page?.data ?? []).filter((item) => item.id !== found.id).slice(0, 4));
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const gallery = useMemo(() => [0, 1, 2], []);

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

  const soldOut = product.stock <= 0;

  const add = async (then?: () => void) => {
    setBusy(then ? 'buy' : 'add');
    try {
      await addItem(product, quantity);
      if (then) then();
      else toast.push('أُضيف إلى السلة');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر الإضافة', 'error');
    } finally {
      setBusy(null);
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
        <div className="gallery">
          <ProductArt
            name={product.name}
            image={product.images?.[0]?.url ?? null}
            variant={view}
            className="gallery__main"
          />
          <div className="gallery__thumbs">
            {gallery.map((index) => (
              <button
                key={index}
                type="button"
                className={`gallery__thumb ${view === index ? 'active' : ''}`}
                onClick={() => setView(index)}
                aria-label={`عرض ${index + 1}`}
                aria-pressed={view === index}
              >
                <ProductArt
                  name={product.name}
                  image={product.images?.[0]?.url ?? null}
                  variant={index}
                />
              </button>
            ))}
          </div>
          <div className="trust-strip">
            <span>✓ أصلي ومضمون</span>
            <span>↺ إرجاع 30 يوماً</span>
            <span>⚡ شحن سريع</span>
          </div>
        </div>

        <div className="detail__body">
          <div className="row between">
            <span className="badge">{product.category?.name ?? 'منتجات'}</span>
            <span className="muted small" dir="ltr">
              SKU: {product.id.slice(0, 8)}
            </span>
          </div>
          <h1>{product.name}</h1>
          <Stars />
          <div className="detail__price">{money(product.price, product.currency)}</div>
          <div className="muted small detail__price-note">
            شامل الضريبة · شحن مجاني
          </div>

          <p className="detail__desc">{product.description}</p>

          <div className="row small" style={{ gap: 10, marginBlockEnd: 18 }}>
            {soldOut ? (
              <span className="badge badge--danger">نفدت الكمية</span>
            ) : product.stock <= 5 ? (
              <span className="badge badge--warn">آخر {product.stock} قطع — اطلب الآن</span>
            ) : (
              <span className="badge">متوفر في المخزون ({product.stock})</span>
            )}
            <span className="muted">يُشحن خلال 24 ساعة</span>
          </div>

          <div className="buy-row" ref={buyRowRef}>
            <div className="qty" aria-label="الكمية">
              <button
                type="button"
                onClick={() => setQuantity((v) => Math.max(1, v - 1))}
                aria-label="تقليل"
              >
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
              className="btn btn--ghost"
              onClick={() => void add()}
              disabled={soldOut || busy !== null}
            >
              {busy === 'add' ? 'جارٍ الإضافة…' : 'أضف إلى السلة'}
            </button>
            <button
              type="button"
              className="btn btn--buy"
              onClick={() => void add(() => navigate('/checkout'))}
              disabled={soldOut || busy !== null}
            >
              {busy === 'buy' ? 'جارٍ التحويل…' : 'اشترِ الآن'}
            </button>
          </div>

          <div className="panel feature-card">
            <div className="summary-row">
              <span>طريقة الدفع</span>
              <strong>الدفع عند الاستلام</strong>
            </div>
            <div className="summary-row">
              <span>مدة التوصيل</span>
              <strong>2–4 أيام عمل</strong>
            </div>
            <div className="summary-row">
              <span>الإرجاع</span>
              <strong>خلال 30 يوماً</strong>
            </div>
            <div className="summary-row">
              <span>الدعم</span>
              <strong>فريق عربي خلال ساعات العمل</strong>
            </div>
          </div>
        </div>
      </div>

      <section className="panel product-tabs">
        <div className="tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {tab === 'desc' ? (
            <div className="stack" style={{ gap: 10 }}>
              <p>{product.description}</p>
              <ul className="feature-list">
                <li>المنتج في تصنيف {product.category?.name ?? 'منتجات'}.</li>
                <li>السعر {money(product.price, product.currency)} شامل ضريبة القيمة المضافة.</li>
                <li>الكمية المتاحة حالياً {product.stock} قطعة.</li>
              </ul>
            </div>
          ) : null}
          {tab === 'ship' ? (
            <ul className="feature-list">
              <li>تجهيز الطلب خلال 24 ساعة من التأكيد.</li>
              <li>التوصيل من 2 إلى 4 أيام عمل داخل المدن الرئيسية.</li>
              <li>تُبلّغ برقم تتبّع على بريدك عند شحن الطلب.</li>
              <li>الشحن مجاني على كل الطلبات.</li>
            </ul>
          ) : null}
          {tab === 'return' ? (
            <ul className="feature-list">
              <li>إرجاع أو استبدال خلال 30 يوماً من الاستلام.</li>
              <li>يجب أن يكون المنتج بحالته الأصلية وبتغليفه.</li>
              <li>الإلغاء متاح من صفحة الطلب قبل الشحن.</li>
              <li>للإرجاع تواصل مع الدعم برقم الطلب.</li>
            </ul>
          ) : null}
        </div>
      </section>

      {related.length > 0 ? (
        <section className="section" style={{ marginBlockStart: 34 }}>
          <div className="section__head">
            <div>
              <h2>منتجات مشابهة</h2>
              <p>من نفس التصنيف</p>
            </div>
            {product.category ? (
              <Link className="btn btn--ghost btn--sm" to={`/products?cat=${product.category.slug}`}>
                عرض التصنيف
              </Link>
            ) : null}
          </div>
          <div className="grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}

      <div className={`sticky-buy${showSticky ? ' is-visible' : ''}`} aria-hidden={!showSticky}>
        <div>
          <strong>{money(product.price, product.currency)}</strong>
          <span className="muted small" style={{ display: 'block' }}>
            {soldOut ? 'غير متوفر' : `${product.stock} قطعة متوفرة`}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--buy"
          onClick={() => void add(() => navigate('/checkout'))}
          disabled={soldOut || busy !== null}
        >
          اشترِ الآن
        </button>
      </div>
      <div style={{ height: 30 }} />
    </>
  );
}
