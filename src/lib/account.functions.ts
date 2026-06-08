import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CourseTypeSchema = z.enum(["private", "student", "group", "cardio"]);

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, creditsRes, bookingsRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("member_credits").select("*").eq("user_id", userId),
      supabase
        .from("bookings")
        .select("id, slot_date, slot_hour, course_type, is_trial, created_at")
        .eq("user_id", userId)
        .order("slot_date", { ascending: false })
        .limit(50),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const profile = profileRes.data;
    const credits = creditsRes.data ?? [];
    const allTypes: Array<"private" | "student" | "group" | "cardio"> = ["private", "student", "group", "cardio"];
    const creditsMap = Object.fromEntries(credits.map((c) => [c.course_type, c.remaining])) as Record<string, number>;
    const creditList = allTypes.map((t) => ({ course_type: t, remaining: creditsMap[t] ?? 0 }));

    return {
      profile,
      credits: creditList,
      bookings: bookingsRes.data ?? [],
      isAdmin: (rolesRes.data ?? []).some((r) => r.role === "admin"),
    };
  });

export const createPurchaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { course_type: string; quantity: number; unit_price: number; note?: string }) =>
    z
      .object({
        course_type: CourseTypeSchema,
        quantity: z.number().int().min(1).max(50),
        unit_price: z.number().int().min(0).max(10000),
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("purchase_requests").insert({
      user_id: userId,
      course_type: data.course_type,
      quantity: data.quantity,
      unit_price: data.unit_price,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("bookings").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const createMemberBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slot_date: string; slot_hour: number; course_type: string; note?: string }) =>
    z
      .object({
        slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slot_hour: z.number().int().min(0).max(23),
        course_type: CourseTypeSchema,
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let { data: profile } = await supabase.from("profiles").select("phone, display_name").eq("user_id", userId).maybeSingle();
    if (!profile) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
      const phone = (userRes?.user?.user_metadata as { phone?: string } | null)?.phone;
      const display_name = (userRes?.user?.user_metadata as { display_name?: string } | null)?.display_name ?? (phone ? `会员-${phone.slice(-4)}` : null);
      if (!phone) throw new Error("会员资料未初始化，请重新登录");
      await supabaseAdmin.from("profiles").upsert({ user_id: userId, phone, display_name }, { onConflict: "user_id" });
      profile = { phone, display_name };
    }

    const { error } = await supabase.from("bookings").insert({
      slot_date: data.slot_date,
      slot_hour: data.slot_hour,
      course_type: data.course_type,
      customer_name: profile.display_name ?? `会员-${profile.phone.slice(-4)}`,
      customer_phone: profile.phone,
      note: data.note ?? null,
      user_id: userId,
      is_trial: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
