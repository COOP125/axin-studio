import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CourseTypeSchema = z.enum(["private", "student", "group", "cardio"]);

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("没有管理员权限");
  return supabaseAdmin;
}

/** 列出所有课表条目 + 教练昵称，用于管理员编辑器 */
export const adminListSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context.userId);
    const { data: schedules, error } = await admin
      .from("class_schedules")
      .select("id, weekday, slot_hour, course_type, coach_id, is_active")
      .order("weekday", { ascending: true })
      .order("slot_hour", { ascending: true });
    if (error) throw new Error(error.message);
    const coachIds = Array.from(new Set((schedules ?? []).map((s) => s.coach_id).filter(Boolean) as string[]));
    const profiles = coachIds.length
      ? (await admin.from("profiles").select("user_id, nickname, display_name, phone").in("user_id", coachIds)).data ?? []
      : [];
    const pMap = new Map(profiles.map((p) => [p.user_id, p.nickname ?? p.display_name ?? p.phone ?? "教练"]));
    return (schedules ?? []).map((s) => ({
      ...s,
      coach_name: s.coach_id ? (pMap.get(s.coach_id) ?? "未知教练") : null,
    }));
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  weekday: z.number().int().min(0).max(6),
  slot_hour: z.number().int().min(6).max(22),
  course_type: CourseTypeSchema,
  coach_id: z.string().uuid().nullable(),
  is_active: z.boolean().default(true),
});

export const adminUpsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof UpsertSchema>) => UpsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await admin
        .from("class_schedules")
        .update({
          weekday: data.weekday,
          slot_hour: data.slot_hour,
          course_type: data.course_type,
          coach_id: data.coach_id,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("class_schedules").insert({
        weekday: data.weekday,
        slot_hour: data.slot_hour,
        course_type: data.course_type,
        coach_id: data.coach_id,
        is_active: data.is_active,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const adminDeleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { error } = await admin.from("class_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
