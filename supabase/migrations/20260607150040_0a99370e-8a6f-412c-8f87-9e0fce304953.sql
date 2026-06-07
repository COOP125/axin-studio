
-- ============ 1. ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ 2. PROFILES ============
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 3. MEMBER CREDITS ============
CREATE TABLE public.member_credits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_type public.course_type NOT NULL,
  remaining int NOT NULL DEFAULT 0 CHECK (remaining >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_type)
);

GRANT SELECT ON public.member_credits TO authenticated;
GRANT ALL ON public.member_credits TO service_role;

ALTER TABLE public.member_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own credits" ON public.member_credits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ 4. CREDIT TRANSACTIONS ============
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_type public.course_type NOT NULL,
  delta int NOT NULL,
  reason text NOT NULL,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own tx" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ 5. PHONE OTP ============
CREATE TABLE public.phone_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX phone_otp_lookup ON public.phone_otp (phone, created_at DESC);

GRANT ALL ON public.phone_otp TO service_role;
ALTER TABLE public.phone_otp ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role (used by server fns) may access.

-- ============ 6. PURCHASE REQUESTS ============
CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_type public.course_type NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0 AND quantity <= 100),
  unit_price int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own requests" ON public.purchase_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members create own request" ON public.purchase_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- ============ 7. BOOKINGS EXTENSIONS ============
ALTER TABLE public.bookings
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN is_trial boolean NOT NULL DEFAULT false;

-- One free trial per phone, ever.
CREATE UNIQUE INDEX bookings_trial_per_phone
  ON public.bookings (customer_phone)
  WHERE is_trial = true;

-- Members see their own bookings; admins see all.
CREATE POLICY "Members read own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Allow members & admins to cancel.
CREATE POLICY "Members or admin delete bookings" ON public.bookings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Trial validation + member credit deduction
CREATE OR REPLACE FUNCTION public.enforce_booking_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal int;
BEGIN
  IF NEW.is_trial THEN
    IF NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION '已是会员，请使用会员预约';
    END IF;
    IF NEW.course_type NOT IN ('group', 'cardio') THEN
      RAISE EXCEPTION '体验课仅限团操课或有氧课';
    END IF;
  ELSE
    -- Non-trial: must be a logged-in member booking for themselves
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION '请登录会员账户后预约';
    END IF;

    -- Deduct one credit; raise if insufficient
    UPDATE public.member_credits
      SET remaining = remaining - 1, updated_at = now()
      WHERE user_id = NEW.user_id AND course_type = NEW.course_type AND remaining > 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION '该课程剩余次数不足，请先购买课程';
    END IF;

    INSERT INTO public.credit_transactions (user_id, course_type, delta, reason)
      VALUES (NEW.user_id, NEW.course_type, -1, 'booking');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_enforce_rules
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_rules();

-- Refund credit when a non-trial booking is cancelled
CREATE OR REPLACE FUNCTION public.refund_booking_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT OLD.is_trial AND OLD.user_id IS NOT NULL THEN
    INSERT INTO public.member_credits (user_id, course_type, remaining)
      VALUES (OLD.user_id, OLD.course_type, 1)
      ON CONFLICT (user_id, course_type)
        DO UPDATE SET remaining = public.member_credits.remaining + 1, updated_at = now();
    INSERT INTO public.credit_transactions (user_id, course_type, delta, reason)
      VALUES (OLD.user_id, OLD.course_type, 1, 'booking_cancelled');
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER bookings_refund_credit
  AFTER DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.refund_booking_credit();

-- ============ 8. AUTO-CREATE PROFILE + MEMBER ROLE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Default member role for everyone (admin role granted separately)
  INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'member')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
