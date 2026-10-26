# Database Backup Guide (`mysqldump`)

Before executing any database migrations or schema updates on the **LuxeStay Hotel Management System**, always take a full consistent backup of the database using `mysqldump`.

---

## 1. Pre-Migration Full Backup Command

Run the following command from the terminal on the database server or administrator workstation:

```bash
# Standard backup with timestamp
mysqldump -u root -p \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --databases hotel_reservation > "backup_hotel_reservation_$(date +%Y%m%d_%H%M%S).sql"
```

### On Windows PowerShell:

```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
mysqldump.exe -u root -p `
  --single-transaction `
  --quick `
  --routines `
  --triggers `
  --databases hotel_reservation > "backup_hotel_reservation_$timestamp.sql"
```

---

## 2. Explanation of Critical Flags

| Flag | Purpose |
| :--- | :--- |
| `--single-transaction` | Creates a consistent point-in-time snapshot of InnoDB tables without locking the database or blocking ongoing guest bookings. |
| `--quick` | Streams row-by-row directly from the server rather than buffering all rows in memory, preventing RAM exhaustion on large historical datasets. |
| `--routines` | Preserves stored procedures and user-defined functions. |
| `--triggers` | Dumps triggers associated with tables (e.g. audit or status hooks). |
| `--databases hotel_reservation` | Includes the `CREATE DATABASE IF NOT EXISTS` and `USE hotel_reservation` statements in the dump file. |

---

## 3. Verifying the Backup

Always verify that the backup file was successfully created, is non-empty, and contains the trailing dump completion comment:

```powershell
Get-Item .\backup_hotel_reservation_*.sql
Get-Content .\backup_hotel_reservation_*.sql -Tail 5
# Look for: "-- Dump completed on YYYY-MM-DD HH:MM:SS"
```

---

## 4. Disaster Recovery (Restoring from Backup)

If a migration fails or encounters unexpected data errors:

```bash
mysql -u root -p hotel_reservation < backup_hotel_reservation_YYYYMMDD_HHMMSS.sql
```

After restoring, verify the table integrity:

```sql
USE hotel_reservation;
SHOW TABLES;
SELECT COUNT(*) FROM reservations;
SELECT COUNT(*) FROM payments;
```
