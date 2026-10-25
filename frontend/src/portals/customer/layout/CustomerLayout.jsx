import { Outlet } from 'react-router-dom';
import CustomerNav from './CustomerNav';
import Footer from './Footer';

export default function CustomerLayout() {
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
