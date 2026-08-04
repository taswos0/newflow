-- ClinicFlow core schema for Supabase/PostgreSQL

create extension if not exists pgcrypto;

-- Visit state in the live queue.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'visit_status') then
    create type visit_status as enum ('waiting', 'in_consultation', 'completed');
  end if;
end $$;

-- Invoice payment state.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('unpaid', 'partial', 'paid');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('cash', 'wallet');
  end if;
end $$;

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  birth_date date,
  medical_alerts text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists treatments_catalog (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null,
  default_price numeric(12,2) not null check (default_price >= 0),
  category text not null,
  created_at timestamptz not null default now()
);

create table if not exists visits_queue (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  visit_date date not null default current_date,
  status visit_status not null default 'waiting',
  check_in_time timestamptz not null default now(),
  call_time timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references visits_queue(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  remaining_amount numeric(12,2) not null default 0 check (remaining_amount >= 0),
  next_appointment_date date,
  payment_status payment_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  constraint invoice_amounts_valid check (paid_amount <= total_amount)
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  treatment_title text not null,
  price_applied numeric(12,2) not null check (price_applied >= 0),
  created_at timestamptz not null default now()
);

create table if not exists daily_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(12,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  collected_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete set null,
  patient_name text not null,
  phone text not null,
  appointment_date date not null,
  appointment_time time not null default '09:00',
  notes text,
  created_at timestamptz not null default now()
);

alter table appointments add column if not exists appointment_time time not null default '09:00';

create index if not exists idx_patients_phone on patients(phone);
create index if not exists idx_visits_queue_status on visits_queue(status);
create index if not exists idx_visits_queue_visit_date on visits_queue(visit_date);
create index if not exists idx_invoices_patient_id on invoices(patient_id);
create index if not exists idx_daily_expenses_date on daily_expenses(expense_date);
create index if not exists idx_invoice_payments_collected_at on invoice_payments(collected_at);
create index if not exists idx_invoice_payments_method on invoice_payments(method);
create index if not exists idx_appointments_date on appointments(appointment_date);
create index if not exists idx_appointments_phone on appointments(phone);
create index if not exists idx_appointments_date_time on appointments(appointment_date, appointment_time);

-- Clean legacy duplicate appointment slots before enforcing uniqueness.
delete from appointments duplicate_row
using appointments kept_row
where duplicate_row.ctid < kept_row.ctid
  and duplicate_row.appointment_date = kept_row.appointment_date
  and duplicate_row.appointment_time = kept_row.appointment_time;

create unique index if not exists idx_appointments_slot_unique on appointments(appointment_date, appointment_time);
create unique index if not exists idx_treatments_catalog_title_unique on treatments_catalog(title_ar);

-- Authenticated access policies.
-- For production, refine these further by role-specific claims or profile tables.
alter table patients enable row level security;
alter table treatments_catalog enable row level security;
alter table visits_queue enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table daily_expenses enable row level security;
alter table invoice_payments enable row level security;
alter table appointments enable row level security;

drop policy if exists patients_all_access on patients;
create policy patients_all_access on patients
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists treatments_catalog_all_access on treatments_catalog;
create policy treatments_catalog_all_access on treatments_catalog
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists visits_queue_all_access on visits_queue;
create policy visits_queue_all_access on visits_queue
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists invoices_all_access on invoices;
create policy invoices_all_access on invoices
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists invoice_items_all_access on invoice_items;
create policy invoice_items_all_access on invoice_items
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists daily_expenses_all_access on daily_expenses;
create policy daily_expenses_all_access on daily_expenses
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists invoice_payments_all_access on invoice_payments;
create policy invoice_payments_all_access on invoice_payments
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists appointments_all_access on appointments;
create policy appointments_all_access on appointments
  for all to authenticated
  using (true)
  with check (true);
