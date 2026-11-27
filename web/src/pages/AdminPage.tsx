import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { STATUS_LABEL, api, money } from '../api';
import type { Category, Order, OrderStatus, Page, Product } from '../api';
import { EmptyState, Field, ProductArt, Spinner, useToast } from '../ui';

type Tab = 'products' | 'categories' | 'orders';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('products');

  return (
    <>
      <div className="section__head" style={{ marginBlockStart: 26 }}>
        <div>
          <h1 style={{ fontSize: '1.7rem' }}>لوحة الإدارة</h1>
          <p>إدارة المنتجات والتصنيفات وحالة الطلبات</p>
        </div>
        <a className="btn btn--ghost btn--sm" href="/docs" target="_blank" rel="noreferrer">
          وثائق API
        </a>
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          المنتجات
        </button>
        <button type="button" role="tab" className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>
          التصنيفات
        </button>
        <button type="button" role="tab" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          حالة الطلب
        </button>
      </div>

      {tab === 'products' ? <ProductsTab /> : null}
      {tab === 'categories' ? <CategoriesTab /> : null}
      {tab === 'orders' ? <OrdersTab /> : null}
      <div style={{ height: 40 }} />
    </>
  );
}

function ProductsTab() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    price: '',
    stock: '',
    categoryId: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [page, cats] = await Promise.all([
        api<Page<Product>>('/products?limit=50'),
        api<Category[]>('/categories'),
      ]);
      setProducts(page.data);
      setCategories(cats);
      setForm((prev) => ({ ...prev, categoryId: prev.categoryId || cats[0]?.id || '' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api<Product>('/admin/products', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price: Math.round(Number(form.price) * 100),
          stock: Number(form.stock),
          categoryId: form.categoryId,
        },
      });
      toast.push('أُضيف المنتج');
      setForm({ name: '', price: '', stock: '', categoryId: form.categoryId, description: '' });
      await load();
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر إنشاء المنتج', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (product: Product) => {
    try {
      await api(`/admin/products/${product.id}`, {
        method: 'PATCH',
        body: { isActive: !product.isActive },
      });
      toast.push(product.isActive ? 'أُوقف عرض المنتج' : 'أُعيد عرض المنتج');
      await load();
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر التحديث', 'error');
    }
  };

  return (
    <div className="cart-layout">
      <div className="panel">
        <h2 style={{ fontSize: '1.1rem', marginBlockEnd: 12 }}>المنتجات الحالية</h2>
        {loading ? (
          <Spinner />
        ) : products.length === 0 ? (
          <EmptyState title="لا توجد منتجات" hint="أضف أول منتج من النموذج." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>السعر</th>
                  <th>المخزون</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <div style={{ width: 42, flex: 'none' }}>
                          <ProductArt name={product.name} image={product.images?.[0]?.url ?? null} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{product.name}</div>
                          <div className="muted small">{product.category?.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>{money(product.price, product.currency)}</td>
                    <td>{product.stock}</td>
                    <td>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void toggleActive(product)}>
                        {product.isActive ? 'إيقاف' : 'تفعيل'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="panel">
        <h2 style={{ fontSize: '1.1rem', marginBlockEnd: 12 }}>منتج جديد</h2>
        <form className="form" onSubmit={(event) => void create(event)}>
          <Field label="الاسم">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              minLength={2}
            />
          </Field>
          <Field label="السعر (ر.س)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              required
            />
          </Field>
          <Field label="المخزون">
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => setForm({ ...form, stock: event.target.value })}
              required
            />
          </Field>
          <Field label="التصنيف">
            <select
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الوصف">
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <button type="submit" className="btn btn--block" disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'إضافة المنتج'}
          </button>
        </form>
      </aside>
    </div>
  );
}

function CategoriesTab() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setCategories(await api<Category[]>('/categories'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/admin/categories', { method: 'POST', body: { name: name.trim() } });
      setName('');
      toast.push('أُضيف التصنيف');
      await load();
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر إنشاء التصنيف', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cart-layout">
      <div className="panel">
        <h2 style={{ fontSize: '1.1rem', marginBlockEnd: 12 }}>التصنيفات</h2>
        <table className="table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الرابط</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td style={{ fontWeight: 700 }}>{category.name}</td>
                <td className="muted small" dir="ltr">
                  {category.slug}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="panel">
        <h2 style={{ fontSize: '1.1rem', marginBlockEnd: 12 }}>تصنيف جديد</h2>
        <form className="form" onSubmit={(event) => void create(event)}>
          <Field label="اسم التصنيف" hint="يُولَّد الرابط تلقائياً من الاسم.">
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
          </Field>
          <button type="submit" className="btn btn--block" disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'إضافة'}
          </button>
        </form>
      </aside>
    </div>
  );
}

function OrdersTab() {
  const toast = useToast();
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<OrderStatus>('PAID');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const find = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const found = await api<Order>(`/orders/${orderId.trim()}`);
      setOrder(found);
      setStatus(found.status === 'CANCELLED' ? 'CANCELLED' : 'PAID');
    } catch {
      setOrder(null);
      toast.push('لم نجد طلباً بهذا الرقم', 'error');
    } finally {
      setBusy(false);
    }
  };

  const update = async (event: FormEvent) => {
    event.preventDefault();
    if (!order) return;
    setBusy(true);
    try {
      const updated = await api<Order>(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status, ...(status === 'CANCELLED' && reason ? { reason } : {}) },
      });
      setOrder(updated);
      toast.push('حُدّثت حالة الطلب');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'تعذّر التحديث', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cart-layout">
      <div className="panel">
        <h2 style={{ fontSize: '1.1rem', marginBlockEnd: 12 }}>تحديث حالة طلب</h2>
        <form className="form" onSubmit={(event) => void find(event)}>
          <Field label="رقم الطلب (UUID)">
            <input dir="ltr" value={orderId} onChange={(event) => setOrderId(event.target.value)} required />
          </Field>
          <button type="submit" className="btn btn--ghost" disabled={busy}>
            بحث
          </button>
        </form>

        {order ? (
          <div style={{ marginBlockStart: 20 }}>
            <div className="summary-row">
              <span className="muted">الحالة الحالية</span>
              <span className={`badge ${order.status === 'CANCELLED' ? 'badge--danger' : 'badge--warn'}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </div>
            <div className="summary-row">
              <span className="muted">الإجمالي</span>
              <strong>{money(order.total, order.currency)}</strong>
            </div>
            <div className="summary-row">
              <span className="muted">المنتجات</span>
              <span className="small">{order.items.map((item) => item.productName).join('، ')}</span>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="panel">
        <h2 style={{ fontSize: '1.1rem', marginBlockEnd: 12 }}>الحالة الجديدة</h2>
        <form className="form" onSubmit={(event) => void update(event)}>
          <Field label="الحالة">
            <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
              <option value="PAID">مدفوع</option>
              <option value="SHIPPED">تم الشحن</option>
              <option value="DELIVERED">تم التوصيل</option>
              <option value="CANCELLED">ملغى</option>
            </select>
          </Field>
          {status === 'CANCELLED' ? (
            <Field label="سبب الإلغاء">
              <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} />
            </Field>
          ) : null}
          <button type="submit" className="btn btn--block" disabled={busy || !order}>
            {busy ? 'جارٍ التحديث…' : 'تحديث الحالة'}
          </button>
        </form>
      </aside>
    </div>
  );
}
