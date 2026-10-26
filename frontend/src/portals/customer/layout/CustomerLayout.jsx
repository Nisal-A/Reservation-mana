import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CustomerNav from './CustomerNav';
import Footer from './Footer';

export default function CustomerLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="customer-site-wrapper">
      <CustomerNav />
      <main className="customer-site-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
