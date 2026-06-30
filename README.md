# LuxeStay - Hotel Room Reservation Management System

LuxeStay is a comprehensive, full-stack Hotel Room Reservation Management System designed to automate the hotel reservation process. It allows customers to easily browse and reserve rooms online, while empowering hotel staff (Admins and Receptionists) to seamlessly manage rooms, customers, bookings, check-ins, payments, and generate insightful reports.

This project was built to completely fulfill the System Requirements Specification (SRS) for a standard modern hotel reservation platform.

## Features

### 🏢 Administrator Module
- **Dashboard Overview:** View top-level hotel analytics.
- **User Management:** Create, edit, and remove system users (Receptionists, other Admins, or Customers).
- **Room Management:** Add, update, and delete rooms. Set room prices, status (Available, Occupied, Maintenance), and upload room images directly.
- **Reports:** Generate daily/monthly reservation reports, revenue reports, and occupancy statistics.

### 🛎️ Receptionist Module
- **Check-In / Check-Out:** Verify reservations, check guests into their assigned rooms, process check-outs, generate final bills, and record payment methods (Cash/Card/Online).
- **Customer Management:** View, search, add, edit, and delete customer profiles directly from the desk.
- **Reservation Management:** Create reservations for walk-in guests or callers, modify bookings, and handle cancellations.

### 👤 Customer Module
- **Browse & Book:** Search available rooms for specific dates, view room details, and book securely.
- **My Bookings:** View past and upcoming reservations, and cancel pending/confirmed bookings.
- **Profile Management:** Update personal information and change passwords securely.

## Tech Stack

**Frontend:**
- React (Vite)
- React Router DOM
- Context API (for State/Auth Management)
- CSS (Vanilla, highly customized for a premium UI)
- Lucide React (Icons)
- React Hot Toast (Notifications)

**Backend:**
- Node.js & Express.js
- MySQL (with `mysql2/promise`)
- JSON Web Tokens (JWT) for authentication
- bcryptjs for password hashing
- Multer (for handling room image uploads)

## Project Structure

```
Hotel-Reservation-System/
│
├── backend/                  # Node.js Express Server
│   ├── config/               # Database connection
│   ├── middleware/           # Auth and Role guards
│   ├── public/uploads/       # Uploaded room images
│   ├── routes/               # Express API routes
│   ├── database.sql          # SQL Schema & Seed Data
│   └── server.js             # Entry point
│
└── frontend/                 # React Application
    ├── public/
    ├── src/
    │   ├── api/              # Axios instance configuration
    │   ├── components/       # Reusable UI components (Sidebar, Layout, UI Elements)
    │   ├── context/          # Auth context
    │   ├── pages/            # Page Views (Admin, Reception, Customer, Auth)
    │   ├── App.jsx           # App Routing
    │   └── index.css         # Global Styles & Design System
    └── vite.config.js
```

## Getting Started

### Prerequisites
- Node.js (v16+)
- MySQL Server

### 1. Database Setup
1. Open your MySQL client.
2. Run the SQL script located at `backend/database.sql`. This will create the database `hotel_reservation`, setup all necessary tables, and insert seed data (including initial admin/reception accounts and sample rooms).

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` directory (if not present) with the following structure:
   ```env
   PORT=3001
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=hotel_reservation
   JWT_SECRET=your_super_secret_jwt_key
   JWT_EXPIRES_IN=7d
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

## Default Seed Accounts

The `database.sql` script creates a few default accounts to help you get started:

- **Admin Account:**
  - Username: `admin`
  - Password: `admin`
- **Reception Account:**
  - Username: `user1`
  - Password: `user1`

You can use these credentials to log in immediately after setup. Customer accounts can be created from the Registration page.

## Compliance with SRS
This system was built to adhere directly to all Functional and Non-Functional requirements specified, including prevention of double booking, secure password encryption, role-based access, and all specified user, room, and reservation management modules.
