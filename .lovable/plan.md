

# Client Invoice Feature — Facturas

## Summary
Add a USD client invoicing system alongside the existing MXN payroll. Two new Supabase tables, a new Facturas page with list/create/detail views, and navigation update.

## Step 1: Supabase Migration

Create two tables:

**`clients`** — Static client reference data:
- `id` uuid PK
- `name` text (Torro, BTC, HFB, Scoop)
- `prefix` text (JOI, BTC, HFB, SCO)
- `bill_to_name` text
- `bill_to_address` text

**`invoices`** — Invoice headers:
- `id` uuid PK
- `client_id` uuid FK → clients
- `invoice_number` text (e.g. JOI-14)
- `week_number` integer
- `week_start` date
- `week_end` date
- `due_date` date (week_end + 4 days)
- `status` text (draft / sent / paid)
- `created_at` timestamptz

**`invoice_lines`** — Per-agent line items:
- `id` uuid PK
- `invoice_id` uuid FK → invoices (cascade delete)
- `agent_name` text
- `days_worked` numeric(4,2) default 0
- `unit_price` numeric(12,2) default 0
- `total` numeric(12,2) default 0
- `spiffs` numeric(12,2) default 0
- `total_price` numeric(12,2) default 0

RLS: authenticated full access (matching existing pattern).

Seed `clients` table with the 4 clients via INSERT in migration.

Also add `client_id` uuid FK column to `employees` table so agents can be assigned to a client.

## Step 2: Hooks — `useInvoices.ts`

New hook file with React Query hooks:
- `useClients()` — fetch all clients
- `useInvoices(clientId?)` — list invoices, optionally filtered by client
- `useInvoice(id)` — single invoice with lines
- `useCreateInvoice()` — insert invoice + lines in a transaction
- `useUpdateInvoiceStatus()` — update status (draft→sent→paid)
- `useAgentsByClient(clientId)` — fetch employees filtered by client_id

## Step 3: Update Employee Model

- Add `client_id` (optional uuid) to the Employee type and mapping functions
- Add a client assignment dropdown in the employee profile page (EmpleadoPerfil)

## Step 4: Navigation Update

Add "Facturas" item to `AppSidebar.tsx` with a `FileText` icon, route `/facturas`.

## Step 5: Facturas Page — Invoice List

`src/pages/Facturas.tsx`:
- Tabs or filter by client
- Table showing: Invoice #, Client, Week, Status, Grand Total, Actions
- "Nueva Factura" button opens the creation flow
- Click row → detail view

## Step 6: New Invoice Flow

`src/pages/FacturaNueva.tsx`:
- Step 1: Select client from dropdown
- Step 2: Enter week number, start date, end date (auto-calculate due date = end + 4 days)
- Step 3: App loads all active agents assigned to that client
- Step 4: Editable table per agent: days worked (0-7), unit price (USD), spiffs (default 0)
- Auto-calculated columns: Total = days × unit price, Total Price = total + spiffs
- Grand total row at bottom
- Buttons: "Guardar Borrador" (save as draft) / "Marcar como Enviada" (save as sent)

## Step 7: Invoice Detail View

`src/pages/FacturaDetalle.tsx`:
- Clean printable layout with:
  - Bill From: JOI, 2886 Avenida Pablo Neruda, Providencia 4A Seccion, Guadalajara, Jalisco, 44369
  - Bill To: client-specific address from `clients` table
  - Invoice number, dates, due date
  - Agent table with all line items
  - Grand total
- Status badge (draft/sent/paid)
- Action buttons: Mark as Sent, Mark as Paid
- Print button (window.print or CSS print styles)

## Step 8: App Router

Add routes in `App.tsx`:
- `/facturas` → Facturas (list)
- `/facturas/nueva` → FacturaNueva (create)
- `/facturas/:id` → FacturaDetalle (detail)

## Technical Notes
- USD formatting: `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
- Invoice logic is completely separate from MXN payroll — no shared calculations
- The `employees` table gets a nullable `client_id` column; existing employees default to null (unassigned)
- Invoice number auto-generated as `{client.prefix}-{weekNumber}`

