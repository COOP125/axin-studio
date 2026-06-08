
ALTER FUNCTION public.course_unit_price(course_type) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.course_unit_price(course_type) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_purchase_request_price() FROM PUBLIC, anon, authenticated;
