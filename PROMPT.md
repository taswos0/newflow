# PROJECT: ClinicFlow - Real-Time Smart Dental & Medical Clinic Management System

## 1. ROLE & OBJECTIVE
You are a Senior Full-Stack Architect and UI/UX Expert. Your objective is to build a modern, real-time, responsive web application ("ClinicFlow") designed for a multi-device clinic environment (Doctor's Laptop/Mobile, Reception Tablets/Mobiles, and a Waiting Room Display) connected to the same local network or internet.

---

## 2. TECH STACK & CORE LIBRARIES
*   **Framework:** Next.js (App Router, TypeScript)
*   **Styling & UI:** Tailwind CSS, Shadcn UI, Lucide Icons (Clean, Minimalist Medical Theme)
*   **Database & Real-Time:** Supabase (PostgreSQL, Supabase Realtime, Supabase Storage for medical files/X-rays)
*   **State Management & Data Fetching:** TanStack Query (React Query) / Zustand
*   **Internationalization & Direction:** Native Arabic language support with strict RTL (Right-to-Left) layout design by default.

---

## 3. USER ROLES & PERMISSIONS

### A. Receptionist (السكرتارية) - Optimized for Tablets/Mobiles
*   Register new patients & manage existing profiles (Name, Age, Phone, Medical Alerts).
*   Manage the daily queue (`Waiting` -> `In-Consultation` -> `Completed`).
*   Send instant **"Send Patient In"** trigger to the Doctor's Dashboard and Waiting Screen.
*   View auto-generated checkout bills (Treatments, Total Amount, Next Appointment) without interrupting the Doctor.
*   Manage payments, installments, and daily financial receipts.

### B. Doctor (الطبيب) - Optimized for Laptop/Tablet
*   Live dashboard showing the current active patient and upcoming waiting queue.
*   Instant visual/toast notification when the receptionist calls a patient in.
*   Full Patient EMR (Electronic Medical Record): Medical history, previous visits, X-rays/attachments, and clinical notes.
*   Interactive **"Session Checkout & Billing"**: One-click treatment selection from a customizable price list + recommended next appointment date.

### C. Waiting Room Display (شاشة الانتظار) - Optimized for Tablet/TV Browser
*   Minimalist public screen showing current patient name being called and the next 2 patients in line (Audio/Visual chime on update).

---

## 4. CORE MODULES & FUNCTIONAL REQUIREMENTS

### Module 1: Real-Time Queue & Anti-Embarrassment Workflow
*   **Problem Solved:** Prevents patients from entering unannounced and eliminates communication friction between Doctor and Receptionist.
*   **Flow:**
    1. Patient arrives -> Receptionist registers them into `Queue (Status: Waiting)`.
    2. Receptionist clicks **"إدخال المريض" (Call Patient)** -> Supabase Realtime instantly:
       * Updates Waiting Room Display: Shows *"الرجاء دخول: [اسم المريض] إلى غرفة الكشف"*.
       * Updates Doctor's Screen: Displays the patient's full profile and medical history automatically before the patient walks through the door.
    3. Status changes to `In-Consultation (في الكشف)`.

### Module 2: Instant Billing & Appointment Sync (نظام الحسابات والمواعيد اللحظي)
*   **Problem Solved:** Automates financial communication without the receptionist needing to ask the doctor about treatment costs.
*   **Flow:**
    1. Inside the consultation view, the Doctor selects treatments performed from a predefined **Treatments Catalog** (e.g., حشو عصب, تنظيف, خلع) with default prices (editable per case).
    2. Doctor selects recommended **Next Appointment Date** (or "No further appointments").
    3. Doctor clicks **"إتمام الجلسة وإرسال الحساب" (Complete Session & Send Bill)**.
    4. Receptionist instantly receives the checkout invoice on their tablet showing: Total Cost, Selected Treatments, Discount (if any), Amount Paid vs. Remaining Balance, and Next Appointment.

### Module 3: Electronic Medical Records (EMR - الملف الطبي الذكي)
*   **Patient Profile Page:**
    *   Personal details (Name, Age, Phone, Medical Alerts like Diabetes/Allergies in prominent warning badges).
    *   **Visit History Timeline:** Chronological list of all past sessions, procedures done, and dentist's clinical notes.
    *   **Media & Attachments:** Drag-and-drop X-ray/photo gallery using Supabase Storage.

### Module 4: Daily Accounting & Financial Dashboard (الحسابات اليومية والتقارير)
*   **Daily Cashflow Summary:** Total Revenue of the day, Cash collected, Remaining receivables (آجل/متبقي).
*   **Expenses Tracker:** Quick entry for daily clinic expenses (supplies, lab fees, operational costs).
*   **Net Daily/Monthly Profit View** (Doctor Access Only).

---

## 5. DATABASE SCHEMA DESIGN (SUPABASE / POSTGRESQL)

Create clean, relational tables with clear Primary and Foreign Keys:
1.  `patients` (id, full_name, phone, birth_date, medical_alerts, created_at)
2.  `treatments_catalog` (id, title_ar, default_price, category)
3.  `visits_queue` (id, patient_id, visit_date, status ['waiting', 'in_consultation', 'completed'], check_in_time, call_time)
4.  `invoices` (id, visit_id, patient_id, total_amount, paid_amount, remaining_amount, next_appointment_date, payment_status, created_at)
5.  `invoice_items` (id, invoice_id, treatment_title, price_applied)
6.  `daily_expenses` (id, title, amount, expense_date)

---

## 6. UI/UX DESIGN INSTRUCTIONS
*   **Language & Typography:** Arabic RTL interface using a clean, modern Arabic font (e.g., Cairo, Alexandria, or Tajawal).
*   **Color Palette:** Clean Medical Light Theme (Calm Teal/Blue primary `#0F766E` or `#0369A1`, Soft Gray backgrounds, crisp white cards).
*   **Responsiveness:** Use CSS Grid and Tailwind flexbox so tables and forms turn into clean cards on mobile/tablet devices.
*   **Feedback:** Toast notifications (using `sonner`) for every action (e.g., "تم إرسال الحساب للريسبشن بنجاح").

---

## 7. EXECUTION PLAN FOR THE AI AGENT
1.  **Step 1:** Initialize the Next.js project with Tailwind CSS, Shadcn UI components, and Supabase client configuration.
2.  **Step 2:** Generate the SQL migration scripts for the schema above (`schema.sql`) and include seed data for common dental treatments in `seed.sql`.
3.  **Step 3:** Build the Navigation & Role Switcher (Doctor View / Reception View / Display View) for easy local testing.
4.  **Step 4:** Build the Real-Time Queue & Consultation Workflow (Module 1 & Module 2) using Supabase Realtime subscriptions.
5.  **Step 5:** Build the Patient EMR, Media Uploads, and Daily Accounting Dashboards.

Please start by acknowledging this architecture, setting up the folder structure, installing necessary dependencies, and generating the database schema file (`schema.sql`).