
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  client_name TEXT NOT NULL,
  product TEXT NOT NULL,
  gross_value NUMERIC NOT NULL DEFAULT 0,
  net_value NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  closer TEXT NOT NULL,
  sdr TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  lead_source TEXT,
  down_payment NUMERIC,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales"
ON public.sales FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert sales"
ON public.sales FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sales"
ON public.sales FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete sales"
ON public.sales FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
