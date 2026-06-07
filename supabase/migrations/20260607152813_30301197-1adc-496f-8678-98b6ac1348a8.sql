
-- 1) Tighten bookings INSERT policy (replace always-true)
DROP POLICY IF EXISTS "Anyone can create a booking" ON public.bookings;

CREATE POLICY "Guests can create trial bookings"
  ON public.bookings FOR INSERT
  TO anon
  WITH CHECK (is_trial = true AND user_id IS NULL);

CREATE POLICY "Members create own bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_trial = false AND user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) purchase_requests: admin-only update/delete
CREATE POLICY "Admin updates purchase requests"
  ON public.purchase_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin deletes purchase requests"
  ON public.purchase_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) phone_otp: explicit deny-all for client roles. All access goes through SECURITY DEFINER server functions using service_role.
REVOKE ALL ON public.phone_otp FROM anon, authenticated;

CREATE POLICY "Deny all phone_otp access"
  ON public.phone_otp FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 4) Revoke EXECUTE on internal SECURITY DEFINER functions (triggers / internal helpers)
REVOKE EXECUTE ON FUNCTION public.enforce_booking_capacity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_booking_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_booking_credit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role and get_slot_counts and course_capacity are intentionally callable (used by RLS / app reads)
