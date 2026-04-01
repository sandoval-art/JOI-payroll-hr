
-- Create clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prefix text NOT NULL UNIQUE,
  bill_to_name text,
  bill_to_address text,
  created_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  invoice_number text NOT NULL,
  week_number integer NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- Create invoice_lines table
CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  days_worked numeric(4,2) DEFAULT 0,
  unit_price numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  spiffs numeric(12,2) DEFAULT 0,
  total_price numeric(12,2) DEFAULT 0
);

-- Add client_id to employees
ALTER TABLE public.employees ADD COLUMN client_id uuid REFERENCES public.clients(id);

-- RLS policies for clients
CREATE POLICY "Allow full access to clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for invoices
CREATE POLICY "Allow full access to invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for invoice_lines
CREATE POLICY "Allow full access to invoice_lines" ON public.invoice_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed clients
INSERT INTO public.clients (name, prefix, bill_to_name, bill_to_address) VALUES
  ('Torro', 'JOI', 'Accounting, Torro', '5965 S 900 E #300, Murray, UT, 84121'),
  ('BTC', 'BTC', 'BTC', ''),
  ('HFB', 'HFB', 'HFB', ''),
  ('Scoop', 'SCO', 'Scoop', '');
