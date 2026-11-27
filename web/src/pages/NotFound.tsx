import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="center-page" style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.4rem' }}>404</h1>
      <p className="muted">الصفحة التي تبحث عنها غير موجودة.</p>
      <Link className="btn" to="/">
        العودة للرئيسية
      </Link>
    </div>
  );
}
