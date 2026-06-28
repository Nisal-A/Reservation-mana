Hotel Room Reservation Management System
System Requirements Specification (SRS)
1. Introduction
Project Title

Hotel Room Reservation Management System

Purpose

The purpose of this system is to automate the hotel reservation process by allowing customers to reserve rooms online and enabling hotel staff to manage rooms, customers, bookings, payments, and reports efficiently.

2. Objectives
Reduce manual paperwork
Improve reservation accuracy
Prevent double booking
Manage room availability
Track customer information
Generate reports
Improve customer experience
3. Users of the System
1. Administrator

Responsibilities:

Manage users
Manage rooms
View reports
Manage reservations
Manage payments
2. Receptionist

Responsibilities:

Register customers
Book rooms
Check-in guests
Check-out guests
View room availability
3. Customer

Responsibilities:

Register account
Login
Search rooms
Reserve room
Cancel reservation
View booking history
4. Functional Requirements
User Management

The system shall allow:

User Registration
User Login
Logout
Password Reset
User Profile Management
Room Management

Administrator can:

Add room
Edit room
Delete room
Change room status
Upload room images
Set room prices

Room Status:

Available
Reserved
Occupied
Under Maintenance
Reservation Management

Customer can:

Search rooms
View room details
Select dates
Book room
Cancel booking

Receptionist can:

Create reservations
Modify reservations
Cancel reservations
Availability Checking

System shall:

Check available rooms
Prevent double booking
Display unavailable dates
Customer Management

Receptionist can:

Add customer
Edit customer
Search customer
Delete customer
Check-In Module

Receptionist can:

Verify reservation
Assign room
Change room status to Occupied
Check-Out Module

Receptionist can:

Generate final bill
Receive payment
Update room status to Available
Payment Module

System shall support:

Cash
Card
Online Payment (optional)

Generate:

Payment receipt
Invoice
Report Module

Administrator can generate:

Daily Reservations
Monthly Reservations
Revenue Report
Occupancy Report
Customer Report
5. Non-Functional Requirements
Performance
Response time less than 3 seconds
Support multiple users simultaneously
Security
Secure login
Password encryption
Role-based access
Session timeout
Reliability
Automatic database backup
Data recovery
Error handling
Usability
Easy-to-use interface
Responsive design
Simple navigation
Availability
System available 24/7
6. Inputs
Customer details
Room details
Reservation details
Payment details
Check-in information
Check-out information
7. Outputs
Reservation Confirmation
Invoice
Payment Receipt
Room Availability List
Daily Report
Monthly Revenue Report
8. Business Rules
One room cannot be booked by multiple customers for overlapping dates.
Check-out date must be after check-in date.
Customer must be registered before booking.
Room must be available before reservation.
Only administrators can delete rooms.
Payments must be completed before check-out.
9. System Modules
Hotel Room Reservation Management System

│
├── User Management
│     ├── Login
│     ├── Register
│     └── Roles
│
├── Room Management
│     ├── Add Room
│     ├── Edit Room
│     ├── Delete Room
│     └── View Rooms
│
├── Reservation Management
│     ├── Search Room
│     ├── Book Room
│     ├── Cancel Booking
│     └── Reservation History
│
├── Customer Management
│
├── Payment Management
│
├── Check-In / Check-Out
│
└── Reports
      ├── Revenue
      ├── Reservations
      ├── Occupancy
      └── Customers
10. Use Case Diagram (Text Version)
                +------------------+
                |    Customer      |
                +------------------+
                  | Login
                  | Search Rooms
                  | Book Room
                  | Cancel Booking
                  | View Booking
                        |
                        |
                -------------------
                        |
                Hotel Reservation System
                        |
    ---------------------------------------------
    |                    |                       |
Administrator      Receptionist            Customer
    |                    |                   |
Manage Rooms        Register Customer      Search Room
Manage Users        Make Reservation       Book Room
View Reports        Check-in Guest         Cancel Booking
Manage Payments     Check-out Guest        View History