import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCoach(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["coach", "admin"]);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("coach") && !roles.includes("admin")) {
    throw new Error("没有教练端访问权限");
  }
  return supabaseAdmin;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekRange(): { start: string; end: string } {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0=Mon
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

function monthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

export const getCoachDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertCoach(context.userId);
    const today = todayISO();
    const week = weekRange();
    const month = monthRange();

    const [todayRes, weekRes, monthRes, profileRes] = await Promise.all([
      admin
        .from("bookings")
        .select("id, slot_date, slot_hour, course_type, customer_name, customer_phone, is_trial, user_id, note")
        .eq("slot_date", today)
        .order("slot_hour", { ascending: true }),
      admin
        .from("bookings")
        .select("course_type, slot_date")
        .gte("slot_date", week.start)
        .lte("slot_date", week.end),
      admin
        .from("bookings")
        .select("course_type")
        .gte("slot_date", month.start)
        .lte("slot_date", month.end),
      admin.from("profiles").select("display_name, nickname, phone").eq("user_id", context.userId).maybeSingle(),
    ]);

    if (todayRes.error) throw new Error(todayRes.error.message);

    const groupBy = (rows: { course_type: string }[]) => {
      const m: Record<string, number> = { private: 0, student: 0, group: 0, cardio: 0 };
      rows.forEach((r) => { m[r.course_type] = (m[r.course_type] ?? 0) + 1; });
      return m;
    };

    // Group week bookings by date for a 7-day view
    const weekRows = weekRes.data ?? [];
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(week.start);
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return iso;
    });
    const byDay = days.map((iso) => ({
      date: iso,
      count: weekRows.filter((r) => r.slot_date === iso).length,
    }));

    return {
      coach: { name: profileRes.data?.nickname ?? profileRes.data?.display_name ?? "教练", phone: profileRes.data?.phone ?? "" },
      today: todayRes.data ?? [],
      weekTotals: groupBy(weekRows),
      monthTotals: groupBy(monthRes.data ?? []),
      weekByDay: byDay,
      weekRange: week,
      monthRange: month,
    };
  });

export const getCoachMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertCoach(context.userId);

    const { data: bookings, error } = await admin
      .from("bookings")
      .select("user_id, slot_date, slot_hour, course_type, customer_name, customer_phone")
      .not("user_id", "is", null)
      .order("slot_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    // Group by user_id
    type MemberStat = {
      user_id: string;
      name: string;
      phone: string;
      total: number;
      lastDate: string;
      lastCourse: string;
    };
    const map = new Map<string, MemberStat>();
    (bookings ?? []).forEach((b) => {
      if (!b.user_id) return;
      const existing = map.get(b.user_id);
      if (existing) {
        existing.total += 1;
      } else {
        map.set(b.user_id, {
          user_id: b.user_id,
          name: b.customer_name ?? "—",
          phone: b.customer_phone ?? "",
          total: 1,
          lastDate: b.slot_date,
          lastCourse: b.course_type,
        });
      }
    });

    const list = Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));

    // Also pull profiles for nicknames
    const ids = list.map((m) => m.user_id);
    if (ids.length) {
      const { data: profs } = await admin.from("profiles").select("user_id, nickname, display_name").in("user_id", ids);
      const pmap = new Map((profs ?? []).map((p) => [p.user_id, p.nickname ?? p.display_name]));
      list.forEach((m) => { m.name = (pmap.get(m.user_id) ?? m.name) || m.name; });
    }

    return list;
  });
