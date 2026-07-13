# Robotics Club Store

A lightweight inventory and equipment management system developed for the **Robotics Club, Institute of Engineering (IOE), Purwanchal Campus**.

The application provides a centralized platform for managing the club's inventory, tracking equipment availability, and maintaining borrowing records. It is designed to simplify day-to-day store operations while ensuring accountability and preserving equipment history across executive committee transitions.

---

## Overview

The Robotics Club Store Manager replaces manual inventory logs with a digital dashboard. It enables authorized executive members to manage the club's equipment through an intuitive interface while maintaining accurate records of borrowed items and real-time inventory calculations.

---

## Features

- **Equipment Inventory Management**: Register new items, modify existing equipment specs, or delete/de-list them.
- **Dynamic Quantity Tracking**: Automatically calculates available quantities based on active borrow records.
- **Borrow & Return Management**: Track who borrows equipment, how many units, checked-out dates, and specific return times.
- **Borrow Records**: View full checkout logs for every equipment type, ordered chronologically.
- **Secure Authentication**: Restricts dashboard control to authorized sessions via Supabase Auth.
- **Protected Password Recovery**: Integrated password reset restricted specifically to the club's administrative email.

---

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend Services**: Supabase (Authentication & PostgreSQL Database)

---

## Database Schemas

The application is connected to a Supabase PostgreSQL backend. It relies on the following two tables:

### 1. `items` Table
Stores registered inventory items.
- `id` (uuid, Primary Key, Default: `gen_random_uuid()`)
- `name` (text, Not Null)
- `description` (text, Nullable)
- `total_quantity` (integer, Not Null, Default: `0`)
- `created_at` (timestamp with time zone, Default: `now()`)

### 2. `borrow_records` Table
Tracks check-out and check-in history.
- `id` (bigint, Primary Key, Identity)
- `item_id` (uuid, Foreign Key referencing `items.id`, On Delete Cascade)
- `borrowed_by` (text, Not Null)
- `quantity` (integer, Not Null)
- `borrowed_date` (text, Not Null)
- `notes` (text, Not Null)
- `status` (text, Not Null) - e.g., `"Borrowed"`, `"Returned"`
- `returned_date` (text, Nullable)

---

## Setup & Local Development

### 1. Environment Variables
Create a `.env` file in the project root containing your Supabase project parameters:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anonymous-key
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

### 5. Code Linting
```bash
npm run lint
```

---

## Authentication Configuration

- **Login**: Handles logins using standard Supabase password verification.
- **Password Reset**: Before launching Supabase's `resetPasswordForEmail()`, the client validates that the recipient matches the official authorized administrator account. Reset requests from other email accounts are rejected on the client to protect access boundaries.

---

## Intended Users

This application is intended for the executive committee members of the Robotics Club, IOE Purwanchal Campus, responsible for tracking and auditing club equipment.
