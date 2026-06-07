
CREATE OR REPLACE FUNCTION public.enforce_booking_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count int;
  cap int;
BEGIN
  -- Capacity check (applies to all bookings)
  SELECT COUNT(*) INTO current_count FROM public.bookings
    WHERE slot_date = NEW.slot_date AND slot_hour = NEW.slot_hour;
  cap := public.course_capacity(NEW.course_type);
  IF current_count >= cap THEN
    RAISE EXCEPTION '该时段已约满';
  END IF;

  IF NEW.is_trial THEN
    IF NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION '已是会员，请使用会员预约';
    END IF;
    IF NEW.course_type NOT IN ('group', 'cardio') THEN
      RAISE EXCEPTION '体验课仅限团操课或有氧课';
    END IF;
  ELSE
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION '请登录会员账户后预约';
    END IF;
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

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
