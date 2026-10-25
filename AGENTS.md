# Agent Rules

1. Scope. In scope: customer portal, reception portal, admin portal, reservations, billing/payments, rooms, users, customers, reviews, reports and exports. Out of scope: restaurant, housekeeping, attendance/payroll, inventory, multi-branch, payment gateway, forecasting.
2. Roles: admin, reception, customer. Every protected endpoint must use verifyToken plus requireRole. Customers may only read or change their own profile, reservations and reviews. Hiding a page in React is never security.
3. Money: currency is LKR. Store as DECIMAL(10,2). The server calculates every price; never trust a price, total or rate sent by the client. Price = room nightly rate x nights. No tax and no pricing rules in bookings.
4. Dates: DATE columns are handled as 'YYYY-MM-DD' strings everywhere. Never call toISOString() on a date-only value. Never use CURDATE() in SQL; use the today() helper in backend/src/utils/dates.js (hotel timezone {hotelTimezone}) and pass it as a parameter. A stay occupies nights from check_in_date up to but not including check_out_date.
5. SQL: parameterised queries only. Any change that touches reservations or payments runs inside a transaction.
6. Validation: validate every request body, query and param with zod. Return { message, errors: [] } with the correct status.
7. UI: no emojis; use lucide-react icons. No hard-coded URLs; use frontend/src/config/env.js. Format money with formatLKR(), dates with formatDate().
8. Booking statuses: pending, confirmed, checked_in, checked_out, cancelled, no_show. Payment statuses: unpaid, partial, paid, refunded.
9. After every task: run the backend start check and 'npm run build' and 'npm run lint' in frontend, then report changed files and anything left undone.
10. If a {placeholder} in my prompt is still unfilled, stop and list it. Never invent content, photos, prices or policies.
