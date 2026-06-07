
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
-- get_slot_counts(date, date) intentionally remains callable so guests/members can view slot availability.
