
-- Course type enum
CREATE TYPE public.course_type AS ENUM (
  'private',     -- 私教器械课 (1)
  'student',     -- 中高考应试课 (3)
  'group',       -- 团操课 (8)
  'cardio'       -- 有氧 Cardio (8)
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_date DATE NOT NULL,
  slot_hour SMALLINT NOT NULL CHECK (slot_hour >= 10 AND slot_hour <= 19 AND slot_hour <> 12),
  course_type public.course_type NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bookings_slot_idx ON public.bookings (slot_date, slot_hour);

-- Grants: anon can insert (anonymous booking) but never select PII
GRANT INSERT ON public.bookings TO anon;
GRANT INSERT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a booking
CREATE POLICY "Anyone can create a booking"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Capacity helper
CREATE OR REPLACE FUNCTION public.course_capacity(ct public.course_type)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE ct
    WHEN 'private' THEN 1
    WHEN 'student' THEN 3
    WHEN 'group'   THEN 8
    WHEN 'cardio'  THEN 8
  END;
$$;

-- Trigger: prevent overbooking
CREATE OR REPLACE FUNCTION public.enforce_booking_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INT;
  cap INT;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.bookings
  WHERE slot_date = NEW.slot_date AND slot_hour = NEW.slot_hour;

  cap := public.course_capacity(NEW.course_type);

  IF current_count >= cap THEN
    RAISE EXCEPTION '该时段已约满';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_capacity_check
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_capacity();

-- Public-safe view: only aggregated counts (no PII)
CREATE OR REPLACE FUNCTION public.get_slot_counts(start_date DATE, end_date DATE)
RETURNS TABLE(slot_date DATE, slot_hour SMALLINT, booked INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slot_date, slot_hour, COUNT(*)::INT AS booked
  FROM public.bookings
  WHERE slot_date BETWEEN start_date AND end_date
  GROUP BY slot_date, slot_hour;
$$;

GRANT EXECUTE ON FUNCTION public.get_slot_counts(DATE, DATE) TO anon, authenticated;
