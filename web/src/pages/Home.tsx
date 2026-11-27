import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Category, Page, Product } from '../api';
import { ProductCard, SkeletonGrid } from '../ui';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<Page<Product>>('/products?limit=8'),
      api<Category[]>('/categories'),
    ])
      .then(([page, cats]) => {
        if (!alive) return;
        setProducts(page.data);
        setCategories(cats);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero__grid">
          <div>
            <span className="hero__eyebrow">توصيل خلال 2–4 أيام · دفع عند الاستلام</span>
            <h1>كل ما يحتاجه بيتك، مختار بعناية</h1>
            <p>
              منتجات المنزل والمطبخ والإلكترونيات بأسعار واضحة وصور حقيقية. اطلب اليوم، وادفع عند
              وصول الطلب إلى بابك.
            </p>
            <div className="hero__actions">
              <Link to="/products" className="btn btn--accent">
                تسوّق الآن
              </Link>
              <Link to="/orders" className="btn btn--ghost" style={{ color: '#f4f1e8', borderColor: 'rgba(244,241,232,.35)' }}>
                تتبّع طلباتي
              </Link>
            </div>
            <div className="hero__stats">
              <div className="hero__stat">
                <strong>8+</strong>
                <span>منتج مختار</span>
              </div>
              <div className="hero__stat">
                <strong>30 يوم</strong>
                <span>للاستبدال</span>
              </div>
              <div className="hero__stat">
                <strong>4.8/5</strong>
                <span>تقييم العملاء</span>
              </div>
            </div>
          </div>
          <div className="hero__panel" aria-hidden>
            <div className="hero__panel-row">
              <span className="hero__panel-dot">✓</span>
              <span>دفع آمن عند الاستلام</span>
            </div>
            <div className="hero__panel-row">
              <span className="hero__panel-dot">↺</span>
              <span>إرجاع مجاني خلال 30 يوماً</span>
            </div>
            <div className="hero__panel-row">
              <span className="hero__panel-dot">⚡</span>
              <span>شحن سريع لكل المدن</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2>تسوّق حسب التصنيف</h2>
            <p>ابدأ من الفئة التي تهمّك</p>
          </div>
        </div>
        <div className="chips">
          {categories.map((category) => (
            <Link key={category.id} className="chip" to={`/products?cat=${category.slug}`}>
              {category.name}
            </Link>
          ))}
          <Link className="chip active" to="/products">
            كل المنتجات
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2>الأكثر رواجاً</h2>
            <p>اختيارات هذا الأسبوع من فريق سوق</p>
          </div>
          <Link to="/products" className="btn btn--ghost btn--sm">
            عرض الكل
          </Link>
        </div>
        {loading ? (
          <SkeletonGrid count={4} />
        ) : (
          <div className="grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {[
            { title: 'أسعار بلا مفاجآت', body: 'السعر الظاهر هو ما تدفعه، شامل الضريبة والتوصيل.' },
            { title: 'طلبات موثّقة', body: 'لكل طلب رقم وحالة واضحة، ويمكنك الإلغاء قبل الشحن.' },
            { title: 'دعم إنساني', body: 'فريق عربي يرد على أسئلتك خلال ساعات العمل.' },
          ].map((item) => (
            <article className="panel" key={item.title}>
              <h3 style={{ marginBlockEnd: 8, fontSize: '1.05rem' }}>{item.title}</h3>
              <p className="muted small">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
