import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { money } from './api';
import type { Product } from './api';

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
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const seed = hash(name);
  const usable = image && !image.includes('example.com');
  return (
    <div
      className={`art ${className ?? ''}`}
      style={{ ['--art' as string]: PALETTES[seed % PALETTES.length] }}
    >
      {usable ? (
        <img src={image} alt={name} loading="lazy" />
      ) : (
        <span className="art__glyph" aria-hidden>
          {name.trim().slice(0, 1)}
        </span>
      )}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link className="card" to={`/products/${product.slug}`} aria-label={product.name}>
      <ProductArt name={product.name} image={product.images?.[0]?.url ?? null} />
      <div className="card__body">
        <span className="card__cat">{product.category?.name ?? 'منتجات'}</span>
        <span className="card__name">{product.name}</span>
        <div className="card__foot">
          <span className="price">{money(product.price, product.currency)}</span>
          {product.stock <= 0 ? (
            <span className="badge badge--danger">نفدت الكمية</span>
          ) : product.stock <= 5 ? (
            <span className="badge badge--warn">آخر {product.stock} قطع</span>
          ) : (
            <span className="badge">متوفر</span>
          )}
        </div>
      </div>
    </Link>
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
