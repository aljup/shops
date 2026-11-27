import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth, useCart } from './store';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import NotFound from './pages/NotFound';

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.55L21 8H6" />
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

const LINKS = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/products', label: 'المنتجات' },
  { to: '/orders', label: 'طلباتي' },
];

function Layout() {
  const { user, signOut } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="shell">
      <header className="header">
        <div className="container header__bar">
          <Link to="/" className="logo" aria-label="سوق — الصفحة الرئيسية">
            <span className="logo__mark">س</span>
            <span>سوق</span>
          </Link>
          <nav className="nav" aria-label="التنقل الرئيسي">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            ))}
            {user?.role === 'ADMIN' ? <NavLink to="/admin">لوحة الإدارة</NavLink> : null}
          </nav>
          <div className="header__actions">
            <button
              type="button"
              className="icon-btn burger"
              aria-label="القائمة"
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
            >
              <MenuIcon />
            </button>
            <Link to="/cart" className="icon-btn" aria-label="سلة المشتريات">
              <CartIcon />
              {count > 0 ? <span className="cart-dot">{count}</span> : null}
            </Link>
            {user ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => void signOut()}
                aria-label="تسجيل الخروج"
              >
                خروج
              </button>
            ) : (
              <Link to="/login" className="icon-btn" aria-label="حسابي">
                <UserIcon />
              </Link>
            )}
          </div>
        </div>
        {open ? (
          <div className="container mobile-nav" onClick={() => setOpen(false)}>
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            ))}
            {user?.role === 'ADMIN' ? <NavLink to="/admin">لوحة الإدارة</NavLink> : null}
            {!user ? <NavLink to="/login">تسجيل الدخول</NavLink> : null}
            <span className="muted small" style={{ padding: '4px 12px' }}>
              {location.pathname}
            </span>
          </div>
        ) : null}
      </header>

      <main className="container" style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer__grid">
            <div>
              <div className="logo" style={{ marginBlockEnd: 10 }}>
                <span className="logo__mark">س</span>
                <span>سوق</span>
              </div>
              <p>
                متجر عربي يختار لك منتجات المنزل والمطبخ والإلكترونيات، بأسعار واضحة ودفع عند
                الاستلام.
              </p>
            </div>
            <div>
              <h4>تسوّق</h4>
              <ul>
                <li>
                  <Link to="/products">كل المنتجات</Link>
                </li>
                <li>
                  <Link to="/cart">سلة المشتريات</Link>
                </li>
                <li>
                  <Link to="/orders">طلباتي</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4>الحساب</h4>
              <ul>
                <li>
                  <Link to="/login">تسجيل الدخول</Link>
                </li>
                <li>
                  <Link to="/register">حساب جديد</Link>
                </li>
                <li>
                  <a href="/docs" target="_blank" rel="noreferrer">
                    واجهة API
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer__bottom">
            <span>© {new Date().getFullYear()} سوق — جميع الحقوق محفوظة.</span>
            <span>الدفع عند الاستلام · توصيل خلال 2–4 أيام</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Catalog />} />
        <Route path="products/:slug" element={<ProductPage />} />
        <Route
          path="cart"
          element={
            <RequireAuth>
              <CartPage />
            </RequireAuth>
          }
        />
        <Route
          path="checkout"
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
        />
        <Route
          path="orders"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="orders/:id"
          element={
            <RequireAuth>
              <OrderDetailPage />
            </RequireAuth>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="admin"
          element={
            <RequireAuth admin>
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
