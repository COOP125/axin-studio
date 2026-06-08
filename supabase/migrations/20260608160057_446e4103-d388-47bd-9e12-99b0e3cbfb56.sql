
CREATE OR REPLACE FUNCTION public.course_unit_price(ct course_type)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE ct
    WHEN 'private' THEN 300
    WHEN 'student' THEN 150
    WHEN 'group'   THEN 80
    WHEN 'cardio'  THEN 80
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_purchase_request_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.unit_price := public.course_unit_price(NEW.course_type);
    IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 100 THEN
      RAISE EXCEPTION '购买数量必须在 1 到 100 之间';
    END IF;
    NEW.status := 'pending';
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_purchase_request_price_trg ON public.purchase_requests;
CREATE TRIGGER enforce_purchase_request_price_trg
  BEFORE INSERT ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_purchase_request_price();
