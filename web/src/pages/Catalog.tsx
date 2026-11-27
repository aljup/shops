import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Category, Page, Product } from '../api';
import { EmptyState, ProductCard, SkeletonGrid } from '../ui';

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = params.get('cat') ?? '';
  const [search, setSearch] = useState(q);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  useEffect(() => {
    api<Category[]>('/categories').then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== q) {
        const next = new URLSearchParams(params);
        if (search) next.set('q', search);
        else next.delete('q');
        setParams(next, { replace: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search, q, params, setParams]);

  const query = useMemo(() => {
    const search = new URLSearchParams({ limit: '12' });
    if (q) search.set('q', q);
    if (cat) search.set('categorySlug', cat);
    return search.toString();
  }, [q, cat]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Page<Product>>(`/products?${query}`)
      .then((page) => {
        if (!alive) return;
        setItems(page.data);
        setCursor(page.pageInfo.nextCursor);
        setHasMore(page.pageInfo.hasMore);
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setMore(true);
    try {
      const page = await api<Page<Product>>(`/products?${query}&cursor=${cursor}`);
      setItems((prev) => [...prev, ...page.data]);
      setCursor(page.pageInfo.nextCursor);
      setHasMore(page.pageInfo.hasMore);
    } finally {
      setMore(false);
    }
  }, [cursor, query]);

  return (
    <>
      <div className="section__head" style={{ marginBlockStart: 26 }}>
        <div>
          <h1 style={{ fontSize: '1.7rem' }}>كل المنتجات</h1>
          <p>{loading ? 'جارٍ التحميل…' : `${items.length} منتج${cat ? ' في هذا التصنيف' : ''}`}</p>
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث عن منتج…"
            aria-label="بحث"
          />
        </label>
        <select
          className="select"
          value={cat}
          aria-label="التصنيف"
          onChange={(event) => {
            const next = new URLSearchParams(params);
            if (event.target.value) next.set('cat', event.target.value);
            else next.delete('cat');
            setParams(next);
          }}
        >
          <option value="">كل التصنيفات</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonGrid count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات مطابقة"
          hint="جرّب كلمة بحث أخرى أو اختر تصنيفاً مختلفاً."
        />
      ) : (
        <>
          <div className="grid">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {hasMore ? (
            <div className="row" style={{ justifyContent: 'center', marginBlock: 30 }}>
              <button type="button" className="btn btn--ghost" onClick={() => void loadMore()} disabled={more}>
                {more ? 'جارٍ التحميل…' : 'تحميل المزيد'}
              </button>
            </div>
          ) : null}
        </>
      )}
      <div style={{ height: 40 }} />
    </>
  );
}
