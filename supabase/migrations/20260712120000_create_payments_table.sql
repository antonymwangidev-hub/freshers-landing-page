CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  amount_paid INTEGER NOT NULL CHECK (amount_paid IN (999, 2499)),
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance IN (0, 1500)),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('full', 'deposit')),
  paystack_reference TEXT UNIQUE NOT NULL,
  paystack_access_code TEXT,
  paystack_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_reference ON public.payments (paystack_reference);
CREATE INDEX idx_payments_email ON public.payments (email);
CREATE INDEX idx_payments_status ON public.payments (status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
