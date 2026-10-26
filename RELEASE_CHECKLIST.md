# LuxeStay Release Checklist

Pre-flight release verification checklist for production deployment of LuxeStay Hotel Management System.

---

## 1. Database & Security Pre-Flight
- [ ] Database migrations run and verified on a backup copy first (`mysqldump` verified).
- [ ] Staff passwords set via secure environment variables or `npm run seed:staff` with bcrypt cost 12.
- [ ] Rotate JWT secret (`JWT_SECRET`) and database password (`DB_PASSWORD`) before production deployment (original development `.env` was shared).
- [ ] Ensure `.env` is never committed or present in any archive (`.gitignore` verified).
- [ ] Express security headers (`helmet`) and CORS origin (`FRONTEND_URL`) confirmed.
- [ ] Route security audit clean (`npm run audit:routes` passes with 0 violations).

---

## 2. Content & Assets
- [ ] Real room inventory data and pricing loaded into MySQL (`rooms` table).
- [ ] Real high-resolution room photos loaded into `backend/public/uploads/rooms/`.
- [ ] All placeholders (`{hotelName}`, `{dbName}`, `{hotelTimezone}`) replaced with real hotel content across configuration and UI.
- [ ] Policies, contact numbers, and amenities verified against actual property offerings.

---

## 3. Automated Test Suite & Code Quality
- [ ] Automated test suite fully green:
  - [ ] Backend Jest integration suites passing (`npm test` in `backend/` -> 8/8 suites, 32/32 tests).
  - [ ] Route security audit passing (`npm run audit:routes` in `backend/`).
  - [ ] Frontend Playwright end-to-end smoke tests passing (`npm run test:e2e` in `frontend/` -> 9/9 tests across mobile, tablet, desktop).
- [ ] Frontend linter clean with 0 warnings (`npm run lint` in `frontend/`).
- [ ] Production bundle compiled cleanly with all initial chunks < 300 kB (`npm run build` in `frontend/`).
- [ ] `/dev/ui` development route confirmed removed from production bundle.

---

## 4. Manual Walkthrough & Responsive Verification
- [ ] **Mobile (375px viewport)**:
  - [ ] Customer Portal: Home, room browse, filters, room details, checkout, confirmation, booking list, cancellation.
  - [ ] Reception Portal: Mobile navigation drawer, frontdesk dashboard, reservation list, check-in, billing modal, check-out.
  - [ ] Admin Portal: Navigation, KPI summary, responsive tables, reports overview.
  - [ ] Verify 0 horizontal scrollbar across all mobile pages (`document.documentElement.scrollWidth <= window.innerWidth`).
- [ ] **Tablet (768px viewport)**:
  - [ ] Customer Portal: Grid layouts, filter sidebar, responsive room cards.
  - [ ] Reception Portal: Split view frontdesk, date picker modal, payment recording modal.
  - [ ] Admin Portal: Reports chart rendering, tabular performance views.
- [ ] **Desktop (1280px+ viewport)**:
  - [ ] Customer Portal: Full hero layout, multi-column search, guest review submission with image upload.
  - [ ] Reception Portal: Full calendar grid view, arrivals/departures matrix, payment receipt printouts.
  - [ ] Admin Portal: Full analytics dashboard with Recharts trends, room management with multi-image upload, staff user management.

---

## 5. Exports, Printing & Receipts
- [ ] Customer reservation bill printable directly from browser (`window.print()` layout clean without navigation chrome).
- [ ] Reports export verified in all three formats across date ranges:
  - [ ] CSV: UTF-8 BOM, formulas neutralized (`'` prefix on `=`), correct columns.
  - [ ] XLSX: Generated via `exceljs`, numeric currency with `#,##0.00` format, frozen headers, Summary + Data worksheets.
  - [ ] PDF: Generated via `pdfkit`, landscape A4 table with hotel header and timestamp.

---

## 6. Known System Limitations (Documented & Accepted)
- [ ] **Past Maintenance Periods**: Past room maintenance periods are not historically tracked (only current room status is recorded in `rooms.status`).
- [ ] **No Online Payment Gateway**: Payments are recorded manually by reception/admin staff as cash, card, bank transfer, or offline payment (no Stripe/PayPal/gateway integration).
- [ ] **No Automated Email Notifications**: Booking confirmation and status updates are displayed in the customer portal and printable as PDF/receipt (no external SMTP/email delivery service).
