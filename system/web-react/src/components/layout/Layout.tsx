import { useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import ToastContainer from './ToastContainer';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Derive current page from URL path
  const currentPage = location.pathname.replace('/', '') || 'home';

  const handleNavigate = useCallback((page: string) => {
    navigate(`/${page}`);
  }, [navigate]);

  return (
    <div className="app-shell">
      {/* Hamburger for mobile */}
      <button
        className="hamburger"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="main-content">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}
