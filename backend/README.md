# LuxeStay Hotel Management System - Backend

## Setup Steps

1. Create the database named `hotel_reservation`:
   ```sql
   CREATE DATABASE hotel_reservation;
   ```

2. Copy `.env.example` to `.env` and configure your credentials:
   ```bash
   cp .env.example .env
   ```

3. Run database migrations:
   ```bash
   npm run migrate
   ```

4. Seed staff users (admin & reception):
   ```bash
   npm run seed:staff
   ```

5. (Optional) Seed rooms:
   ```bash
   npm run seed:rooms
   ```

6. Start the backend server:
   ```bash
   npm start
   # or development mode:
   npm run dev
   ```
