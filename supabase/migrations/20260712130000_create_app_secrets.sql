CREATE TABLE IF NOT EXISTS public.app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_app_secret(secret_key TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_secrets WHERE key = secret_key LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_app_secret(TEXT) FROM PUBLIC;
REVOKE ALL ON TABLE public.app_secrets FROM anon, authenticated;
