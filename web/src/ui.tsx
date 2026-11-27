import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { money } from './api';
import type { Product } from './api';
import { useCart } from './store';

const PALETTES = [
  'linear-gradient(135deg, #e8efe9, #cfdfd6)',
  'linear-gradient(135deg, #f6ecdc, #ead4b3)',
  'linear-gradient(135deg, #e6ecef, #cfdbe1)',
  'linear-gradient(135deg, #efe9f2, #dcd0e4)',
  'linear-gradient(135deg, #f2ece2, #ddd0bc)',
  'linear-gradient(135deg, #e7f0ee, #c9e0da)',
];

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) % 9973;
  return value;
}

export function ProductArt({
  name,
  image,
  className,
  variant = 0,
}: {
  name: string;
  image?: string | null;
  className?: string;
  variant?: number;
}) {
  const seed = hash(name) + variant * 3;
  const usable = image && !image.includes('example.com');
  return (
    <div
      className={`art ${className ?? ''}`}
      style={{ ['--art' as string]: PALETTES[seed % PALETTES.length] }}
    >
      {usable ? (
        <img src={image} alt={name} loading="lazy" />
      ) : (
        <span className="art__glyph" aria-hidden style={{ opacity: 1 - variant * 0.15 }}>
          {name.trim().slice(0, 1)}
        </span>
      )}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const soldOut = product.stock <= 0;

  const add = async (then?: () => void) => {
    setBusy(then ? 'buy' : 'add');
    try {
      await addItem(product, 1);
      if (then) then();
      else toast.push('أُضيف إلى السلة');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر الإضافة', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="card">
      <Link to={`/products/${product.slug}`} className="card__link" aria-label={product.name}>
        <ProductArt name={product.name} image={product.images?.[0]?.url ?? null} />
      </Link>
      <div className="card__body">
        <span className="card__cat">{product.category?.name ?? 'منتجات'}</span>
        <Link to={`/products/${product.slug}`} className="card__name">
          {product.name}
        </Link>
        <div className="card__foot">
          <span className="price">{money(product.price, product.currency)}</span>
          {soldOut ? (
            <span className="badge badge--danger">نفدت الكمية</span>
          ) : product.stock <= 5 ? (
            <span className="badge badge--warn">آخر {product.stock} قطع</span>
          ) : (
            <span className="badge">متوفر</span>
          )}
        </div>
        <div className="card__buy">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void add()}
            disabled={soldOut || busy !== null}
          >
            {busy === 'add' ? '…' : 'أضف'}
          </button>
          <button
            type="button"
            className="btn btn--buy btn--sm"
            onClick={() => void add(() => navigate('/checkout'))}
            disabled={soldOut || busy !== null}
          >
            {busy === 'buy' ? '…' : 'اشترِ الآن'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}

export function Spinner({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="center-page" role="status">
      <div className="spinner" />
      <span className="muted small">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint ? <span className="small">{hint}</span> : null}
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="muted small">{hint}</span> : null}
    </div>
  );
}

export function Stars({ rating = 4.8, count = 24 }: { rating?: number; count?: number }) {
  return (
    <div className="stars" aria-label={`تقييم ${rating} من 5`}>
      <span aria-hidden>{'★★★★★'}</span>
      <strong>{rating}</strong>
      <span className="muted small">({count} تقييم)</span>
    </div>
  );
}

type ToastKind = 'ok' | 'error';
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

const ToastContext = createContext<{ push: (text: string, kind?: ToastKind) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.kind === 'error' ? 'toast--error' : ''}`}>
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
