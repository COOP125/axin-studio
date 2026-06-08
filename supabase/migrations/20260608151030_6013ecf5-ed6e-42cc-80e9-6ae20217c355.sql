
-- 1.1 增加 coach 角色到枚举
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coach';

-- 1.2 profiles 表增加字段
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.3 class_schedules 课表模板表
CREATE TABLE IF NOT EXISTS public.class_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  slot_hour smallint NOT NULL CHECK (slot_hour BETWEEN 6 AND 22),
  course_type course_type NOT NULL,
  coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (weekday, slot_hour, course_type, coach_id)
);

GRANT SELECT ON public.class_schedules TO authenticated;
GRANT SELECT ON public.class_schedules TO anon;
GRANT ALL ON public.class_schedules TO service_role;

ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read schedules"
  ON public.class_schedules FOR SELECT
  USING (true);

CREATE POLICY "admins manage schedules"
  ON public.class_schedules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER class_schedules_touch_updated
  BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 1.4 取消规则触发器：会员删除 booking 前检查 3 小时窗口
CREATE OR REPLACE FUNCTION public.enforce_cancel_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  class_start timestamptz;
BEGIN
  -- 管理员可以无限制取消
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN OLD;
  END IF;

  -- 仅限制本人取消自己预约
  IF OLD.user_id IS NULL OR OLD.user_id <> auth.uid() THEN
    -- 非本人取消（且非 admin）应已被 RLS 拦截，但兜底
    RAISE EXCEPTION '无权取消此预约';
  END IF;

  class_start := (OLD.slot_date::timestamp + (OLD.slot_hour || ' hours')::interval) AT TIME ZONE 'Asia/Shanghai';
  IF class_start - now() < interval '3 hours' THEN
    RAISE EXCEPTION '距上课不足3小时，无法取消，请联系工作室';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cancel_window_trg ON public.bookings;
CREATE TRIGGER enforce_cancel_window_trg
  BEFORE DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cancel_window();

-- 1.5 avatars 存储桶的 RLS 策略（桶本身用 storage_create_bucket 工具单独创建）
-- 创建桶后会运行这些策略；先在迁移里写好
CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars user write own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars user update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars user delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
