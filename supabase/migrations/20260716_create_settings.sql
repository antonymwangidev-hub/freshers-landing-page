-- Create settings table and seed default settings

CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY,
  deposit_price integer NOT NULL DEFAULT 999,
  full_price integer NOT NULL DEFAULT 2499,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings (id, deposit_price, full_price)
VALUES (1, 999, 2499)
ON CONFLICT (id) DO NOTHING;
