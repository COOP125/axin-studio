import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CourseTypeSchema = z.enum(["private", "student", "group", "cardio"]);

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("没有教练后台权限");
  return supabaseAdmin;
}

export const adminListMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context.userId);
    const [profilesRes, creditsRes, bookingsRes] = await Promise.all([
      admin.from("profiles").select("user_id, phone, display_name, created_at").order("created_at", { ascending: false }),
      admin.from("member_credits").select("user_id, course_type, remaining"),
      admin.from("bookings").select("user_id").not("user_id", "is", null),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const creditsByUser = new Map<string, Record<string, number>>();
    (creditsRes.data ?? []).forEach((c) => {
      const m = creditsByUser.get(c.user_id) ?? {};
      m[c.course_type] = c.remaining;
      creditsByUser.set(c.user_id, m);
    });

    const bookingsByUser = new Map<string, number>();
    (bookingsRes.data ?? []).forEach((b) => {
      if (!b.user_id) return;
      bookingsByUser.set(b.user_id, (bookingsByUser.get(b.user_id) ?? 0) + 1);
    });

    return (profilesRes.data ?? []).map((p) => ({
      ...p,
      credits: creditsByUser.get(p.user_id) ?? {},
      bookingCount: bookingsByUser.get(p.user_id) ?? 0,
    }));
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { user_id: string; course_type: string; delta: number; reason: string }) =>
      z
        .object({
          user_id: z.string().uuid(),
          course_type: CourseTypeSchema,
          delta: z.number().int().min(-100).max(100),
          reason: z.string().min(1).max(120),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);

    const { data: existing } = await admin
      .from("member_credits")
      .select("remaining")
      .eq("user_id", data.user_id)
      .eq("course_type", data.course_type)
      .maybeSingle();

    const current = existing?.remaining ?? 0;
    const next = current + data.delta;
    if (next < 0) throw new Error("余额不足，无法扣减");

    const { error: upErr } = await admin.from("member_credits").upsert(
      { user_id: data.user_id, course_type: data.course_type, remaining: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id,course_type" },
    );
    if (upErr) throw new Error(upErr.message);

    await admin.from("credit_transactions").insert({
      user_id: data.user_id,
      course_type: data.course_type,
      delta: data.delta,
      reason: data.reason,
      operator_id: context.userId,
    });

    return { ok: true as const, remaining: next };
  });

export const adminListBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { start: string; end: string }) =>
    z
      .object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { data: rows, error } = await admin
      .from("bookings")
      .select("id, slot_date, slot_hour, course_type, customer_name, customer_phone, note, is_trial, user_id, created_at")
      .gte("slot_date", data.start)
      .lte("slot_date", data.end)
      .order("slot_date", { ascending: true })
      .order("slot_hour", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminCancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { error } = await admin.from("bookings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminListPurchaseRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context.userId);
    const { data, error } = await admin
      .from("purchase_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    const profiles = ids.length
      ? (await admin.from("profiles").select("user_id, phone, display_name").in("user_id", ids)).data ?? []
      : [];
    const pMap = new Map(profiles.map((p) => [p.user_id, p]));
    return (data ?? []).map((r) => ({ ...r, profile: pMap.get(r.user_id) ?? null }));
  });

export const adminResolvePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; approve: boolean }) =>
    z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);

    const { data: req, error: fetchErr } = await admin
      .from("purchase_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!req) throw new Error("申请不存在");
    if (req.status !== "pending") throw new Error("该申请已处理");

    if (data.approve) {
      const { data: existing } = await admin
        .from("member_credits")
        .select("remaining")
        .eq("user_id", req.user_id)
        .eq("course_type", req.course_type)
        .maybeSingle();
      const next = (existing?.remaining ?? 0) + req.quantity;
      await admin.from("member_credits").upsert(
        { user_id: req.user_id, course_type: req.course_type, remaining: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,course_type" },
      );
      await admin.from("credit_transactions").insert({
        user_id: req.user_id,
        course_type: req.course_type,
        delta: req.quantity,
        reason: `购买 ${req.quantity} 节 @ ¥${req.unit_price}`,
        operator_id: context.userId,
      });
    }

    await admin
      .from("purchase_requests")
      .update({
        status: data.approve ? "approved" : "rejected",
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
      })
      .eq("id", data.id);

    return { ok: true as const };
  });
