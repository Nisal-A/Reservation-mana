# LuxeStay — Hotel Room Reservation & Property Management System

LuxeStay is an enterprise-grade, full-stack hotel reservation and property management system. Built with modern Node.js/Express, MySQL 8, and React 19, it delivers three dedicated portals tailored to distinct user roles: a public/guest customer booking portal, a frontdesk reception workflow portal, and an executive administration & business analytics portal.

> [!CAUTION]
> **CRITICAL SECURITY NOTICE — SECRET ROTATION REQUIRED**:
> The development `.env` file was previously shared in a project archive. Before deploying to any staging or production environment, you **MUST rotate the `JWT_SECRET`** (generate a cryptographically secure 64-character random string) and change the MySQL database password (`DB_PASSWORD`). Never commit `.env` files to git.

---

## 1. Roles and Portals

LuxeStay implements strict multi-tier role-based access control (RBAC):

1. **Customer Portal (`/`, `/rooms`, `/account/*`)**:
   - Real-time room search with date-range availability checking and guest capacity filters.
   - Self-service booking with atomic concurrency locking (zero double-bookings).
   - Server-computed pricing (nightly rate × nights, currency in LKR).
   - Customer account profile management and booking history.
   - Stay cancellation (within cancellation policy window).
   - Post-stay guest reviews with photo upload and star ratings.
   - Printable HTML guest bills and receipts.

2. **Receptionist Portal (`/reception/*`)**:
   - Frontdesk operations dashboard showing today's arrivals, departures, in-house guests, and pending balances.
   - Walk-in and phone reservation creation with instant room assignment.
   - Check-in workflow with guest ID verification.
   - Check-out workflow with strict balance enforcement (departure refused if balance > 0).
   - Payment and refund recording (cash, card, bank transfer) with reference tracking.
   - Customer directory management and reservation lookups.
   - Visual monthly room availability calendar.

3. **Administrator Portal (`/admin/*`)**:
   - Executive KPI dashboard (Revenue, Occupancy %, ADR, RevPAR, Cash Collected, Outstanding Balances).
   - Enterprise Reports Engine with 8 reporting domains (Overview, Revenue Trends, Occupancy, Room Performance, Reservations, Customers, Payments, Operations).
   - Export reports in CSV (UTF-8 BOM, formula-injection neutralized), XLSX (`exceljs` with numeric currency formats), and PDF (`pdfkit` landscape format).
   - Room inventory management with image uploads (up to 8 images per room, 5MB, random filenames).
   - System user management (create, edit, deactivate staff; last active admin protected).
   - Review moderation (approve/reject guest reviews).
   - Dynamic pricing rules configuration.
   - Immutable audit logging for all staff actions.

---

## 2. Folder Layout

```
Reservation-mana/
├── backend/                         # Express 5 REST API
│   ├── migrations/                  # Sequential SQL & JS migrations (001 - 007)
│   ├── public/uploads/              # Uploaded room and review images
│   ├── scripts/                     # Operational scripts (seed, audit, backup, test db)
│   │   ├── backup-note.md           # Database backup guide using mysqldump
│   │   ├── check-bookings.js        # Reservation concurrency sanity test
│   │   ├── check-indexes.js         # EXPLAIN index verification
│   │   ├── migrate.js               # Database migration runner
│   │   ├── route-audit.js           # Express route & middleware security auditor
│   │   ├── seed-rooms.js            # Initial room types and room inventory seeder
│   │   ├── seed-staff.js            # Admin and reception staff account seeder
│   │   └── setup-test-db.js         # Isolated test database initializer
│   ├── src/
│   │   ├── config/                  # DB connection pool (mysql2) and environment validation (Zod)
│   │   ├── middleware/              # Auth (JWT verification, RBAC), validation, error handling, upload
│   │   ├── routes/                  # Express API routers (auth, rooms, reservations, reports, etc.)
│   │   ├── services/                # Business logic (availability, billing, quote, reports, reservations)
│   │   ├── utils/                   # Dates (Asia/Colombo timezone), audit logging
│   │   └── server.js                # Express app initialization and mounting
│   └── tests/                       # Jest & Supertest automated test suite (8 test suites)
│       └── helpers/                 # Test factories and isolated DB helper
│
├── frontend/                        # React 19 + Vite Single Page Application
│   ├── public/                      # Static brand assets
│   ├── src/
│   │   ├── api/                     # Axios HTTP client with auth interceptors
│   │   ├── components/              # Shared UI components (Navbar, Modal, Button, Card, Toast)
│   │   ├── config/                  # Application environment config
│   │   ├── context/                 # React AuthContext (session state, user profile)
│   │   ├── pages/                   # Admin, Reception, and Shared staff pages
│   │   ├── portals/customer/        # Customer portal layout, navigation, and pages
│   │   ├── utils/                   # Currency formatters (formatLKR), date formatters
│   │   ├── App.jsx                  # React.lazy code-split routing & navigation
│   │   ├── index.css                # CSS design system (tokens, glassmorphism, responsive utilities)
│   │   └── main.jsx                 # React root mount
│   ├── tests/                       # Playwright E2E smoke tests (mobile 375px, tablet 768px, desktop 1280px)
│   └── vite.config.js               # Vite config with manual chunk splitting (< 300 kB per chunk)
│
├── .gitignore                       # Git exclusion rules (node_modules, .env, archives)
├── AGENTS.md                        # Project architecture and security rules
├── README.md                        # Project documentation (this file)
└── RELEASE_CHECKLIST.md             # Production pre-flight verification checklist
```

---

## 3. System Requirements

- **Node.js**: `v20.x` or `v22.x` LTS
- **npm**: `v10.x` or higher
- **MySQL Server**: `8.0+` (InnoDB engine required, `lower_case_table_names=1` or `2` compatible)
- **Modern Web Browser**: Chrome, Firefox, Edge, Safari

---

## 4. Step-by-Step Installation & Setup

### Step 1: Clone and Prepare Environment

```bash
cd "d:\projects\mini reservation mana\Reservation-mana"
```

### Step 2: Create MySQL Database

Open MySQL CLI or Workbench and create the database:

```sql
CREATE DATABASE IF NOT EXISTS hotel_reservation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hotel_reservation_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 3: Configure Backend Environment Variables

In the `backend/` folder, create `.env` based on `.env.example`:

```bash
cd backend
cp .env.example .env
```

Configure your `.env`:
```env
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_secure_db_password
DB_NAME=hotel_reservation
JWT_SECRET=generate_at_least_32_characters_random_secret_string
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://127.0.0.1:5173
HOTEL_TIMEZONE=Asia/Colombo
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password
RECEPTION_USERNAME=reception
RECEPTION_PASSWORD=your_secure_reception_password
```

### Step 4: Install Dependencies & Run Database Migrations

```bash
# Inside backend directory
npm install
npm run migrate
```

### Step 5: Seed Staff Accounts and Initial Rooms

```bash
# Seed initial admin and reception users (hashed with bcrypt cost 12)
npm run seed:staff

# Seed initial room inventory and room types
node scripts/seed-rooms.js
```

### Step 6: Configure Frontend Environment Variables

```bash
cd ../frontend
cp .env.example .env
```

Configure `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_HOTEL_NAME=LuxeStay
```

Install frontend dependencies:
```bash
npm install
```

### Step 7: Start Development Servers

In terminal 1 (Backend API):
```bash
cd backend
npm run dev
# Server will run on http://localhost:3001
```

In terminal 2 (Frontend Client):
```bash
cd frontend
npm run dev
# Client will run on http://localhost:5173
```

---

## 5. Running Automated Tests

LuxeStay features comprehensive automated test coverage for both backend business logic and frontend user flows.

### Backend Automated Test Suite (Jest & Supertest)
Backend tests run against an isolated database (`hotel_reservation_test`) and **never touch** the production database:

```bash
cd backend
npm test
```
*Executes all 8 test suites (32 tests): Auth rate-limiting, booking concurrency, isolation/RBAC, frontdesk lifecycle, admin protections, reports calculations, report exports, and timezone-safe date math.*

### Route Security Audit
Verify that every Express endpoint enforces authentication and RBAC:

```bash
cd backend
npm run audit:routes
```

### Frontend E2E Smoke Test Suite (Playwright)
Executes customer, reception, and admin workflows across 3 responsive viewports (375px mobile, 768px tablet, 1280px desktop):

```bash
cd frontend
npm run test:e2e
```

### Frontend Linting
```bash
cd frontend
npm run lint
```

---

## 6. Building and Serving for Production

### Frontend Production Build
The frontend is code-split with `React.lazy()` and Vite manual chunking. Every chunk is under 300 kB:

```bash
cd frontend
npm run build
```

To preview the production build locally:
```bash
npm run preview
```

### Production Deployment Notes
1. **Frontend**: Deploy the generated `frontend/dist/` folder to any static hosting service (Cloudflare Pages, Vercel, Netlify, or Nginx).
2. **Backend**: Run Express behind a reverse proxy (Nginx or Caddy) with TLS enabled. Use a process manager such as `pm2`:
   ```bash
   cd backend
   pm2 start src/server.js --name "luxestay-api"
   ```
3. **Database Backup**: Follow the pre-migration backup instructions in [backend/scripts/backup-note.md](backend/scripts/backup-note.md).

---

## 7. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Number | `3001` | HTTP listening port for Express. |
| `DB_HOST` | String | `127.0.0.1` | MySQL server hostname or IP address. |
| `DB_PORT` | Number | `3306` | MySQL server port. |
| `DB_USER` | String | `root` | MySQL database username. |
| `DB_PASSWORD` | String | `""` | MySQL database user password. |
| `DB_NAME` | String | `hotel_reservation` | MySQL database schema name. |
| `JWT_SECRET` | String | *Required* | Secret key for signing JWT tokens (min 32 characters). |
| `JWT_EXPIRES_IN` | String | `8h` | Lifetime for signed JWT authentication tokens. |
| `FRONTEND_URL` | String | `http://127.0.0.1:5173` | Allowed CORS origins (comma-separated if multiple). |
| `HOTEL_TIMEZONE` | String | `Asia/Colombo` | Hotel operating timezone for date boundaries. |
| `ADMIN_USERNAME` | String | `admin` | Initial admin username for seeding. |
| `ADMIN_PASSWORD` | String | *Required* | Initial admin password for seeding. |
| `RECEPTION_USERNAME`| String | `reception` | Initial receptionist username for seeding. |
| `RECEPTION_PASSWORD`| String | *Required* | Initial receptionist password for seeding. |

### Frontend (`frontend/.env`)

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | String | `http://localhost:3001` | Base URL of the backend REST API. |
| `VITE_HOTEL_NAME` | String | `LuxeStay` | Brand hotel display name used across the UI. |

---

## 8. License

Copyright © 2026 LuxeStay Management. All rights reserved.
