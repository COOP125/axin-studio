import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { getCoachDashboard, getCoachMembers } from "@/lib/coach.functions";
import { COURSE_META, type CourseType } from "@/lib/schedule";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/coach")({
  component: CoachPage,
});

type Tab = "today" | "stats" | "members";

function CoachPage() {
  const [tab, setTab] = useState<Tab>("today");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />

      <nav className="border-b border-hairline px-6 py-5 md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand">
              <span className="size-3 rounded-full bg-background" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">AXI STUDIO / 教练端</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-brand">查看课表</Link>
            <button onClick={signOut} className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-brand">退出</button>
          </div>
        </div>
      </nav>

      <div className="border-b border-hairline px-6 md:px-10">
        <div className="mx-auto flex max-w-7xl gap-6">
          {(["today", "stats", "members"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"-mb-px border-b-2 px-1 py-4 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors " + (tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t === "today" ? "今日课表" : t === "stats" ? "数据统计" : "会员名册"}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        {tab === "today" && <TodayTab />}
        {tab === "stats" && <StatsTab />}
        {tab === "members" && <MembersTab />}
      </main>
    </div>
  );
}

function TodayTab() {
  const fetchFn = useServerFn(getCoachDashboard);
  const { data, isLoading, error } = useQuery({ queryKey: ["coach", "dashboard"], queryFn: () => fetchFn(), retry: false });

  if (isLoading) return <p className="text-muted-foreground">加载中…</p>;
  if (error) return <ErrorBanner error={error} />;
  if (!data) return null;

  const todayStr = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  // Group today's bookings by hour
  type B = typeof data.today[number];
  const byHour = new Map<number, B[]>();
  data.today.forEach((b) => {
    const list = byHour.get(b.slot_hour) ?? [];
    list.push(b);
    byHour.set(b.slot_hour, list);
  });
  const hours = Array.from(byHour.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Today / {todayStr}</p>
        <h1 className="mt-1 font-display text-3xl font-bold italic">{data.coach.name} · 今日课表</h1>
      </section>

      {hours.length === 0 ? (
        <div className="border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">今日暂无预约</div>
      ) : (
        <div className="space-y-4">
          {hours.map((hour) => {
            const list = byHour.get(hour) ?? [];
            const ct = list[0].course_type as CourseType;
            const meta = COURSE_META[ct];
            return (
              <div key={hour} className="border border-white/10 bg-card p-5">
                <div className="flex items-baseline justify-between border-b border-white/5 pb-3">
                  <div className="flex items-baseline gap-4">
                    <span className="font-display text-3xl font-bold tabular-nums text-brand">{String(hour).padStart(2, "0")}:00</span>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{meta.english}</p>
                      <p className="text-sm font-semibold">{meta.label}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{list.length} / {meta.capacity}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {list.map((b) => (
                    <li key={b.id} className="flex items-center justify-between text-sm">
                      <span>
                        {b.customer_name}
                        {b.is_trial && <span className="ml-2 rounded bg-brand/20 px-1.5 py-0.5 font-mono text-[9px] text-brand">体验</span>}
                      </span>
                      <a href={`tel:${b.customer_phone}`} className="font-mono text-xs text-brand hover:underline">{b.customer_phone}</a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatsTab() {
  const fetchFn = useServerFn(getCoachDashboard);
  const { data, isLoading, error } = useQuery({ queryKey: ["coach", "dashboard"], queryFn: () => fetchFn(), retry: false });

  if (isLoading) return <p className="text-muted-foreground">加载中…</p>;
  if (error) return <ErrorBanner error={error} />;
  if (!data) return null;

  const types: CourseType[] = ["private", "student", "group", "cardio"];
  const maxDay = Math.max(1, ...data.weekByDay.map((d) => d.count));

  return (
    <div className="space-y-10">
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">This Week · 本周</p>
        <p className="mt-1 text-xs text-muted-foreground">{data.weekRange.start} ~ {data.weekRange.end}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {types.map((t) => (
            <div key={t} className="border border-white/10 bg-card p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{COURSE_META[t].english}</p>
              <p className="mt-1 text-sm">{COURSE_META[t].label}</p>
              <p className="mt-3 font-display text-4xl font-bold text-brand">{data.weekTotals[t] ?? 0}</p>
              <p className="font-mono text-[10px] text-muted-foreground">节</p>
            </div>
          ))}
        </div>
        <div className="mt-6 border border-white/10 bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">每日预约数</p>
          <div className="mt-4 flex items-end gap-3 h-32">
            {data.weekByDay.map((d) => {
              const h = Math.max(4, (d.count / maxDay) * 100);
              const dt = new Date(d.date);
              const lbl = ["一", "二", "三", "四", "五", "六", "日"][(dt.getDay() + 6) % 7];
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="font-mono text-[10px] text-muted-foreground">{d.count}</span>
                  <div className="w-full bg-brand/70" style={{ height: `${h}%` }} />
                  <span className="font-mono text-[10px] text-muted-foreground">{lbl}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">This Month · 本月</p>
        <p className="mt-1 text-xs text-muted-foreground">{data.monthRange.start} ~ {data.monthRange.end}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {types.map((t) => (
            <div key={t} className="border border-white/10 bg-card p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{COURSE_META[t].english}</p>
              <p className="mt-1 text-sm">{COURSE_META[t].label}</p>
              <p className="mt-3 font-display text-4xl font-bold text-foreground">{data.monthTotals[t] ?? 0}</p>
              <p className="font-mono text-[10px] text-muted-foreground">节</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MembersTab() {
  const fetchFn = useServerFn(getCoachMembers);
  const { data, isLoading, error } = useQuery({ queryKey: ["coach", "members"], queryFn: () => fetchFn(), retry: false });

  if (isLoading) return <p className="text-muted-foreground">加载中…</p>;
  if (error) return <ErrorBanner error={error} />;

  return (
    <table className="w-full border border-white/10 text-sm">
      <thead className="bg-card text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <tr>
          <th className="p-3">会员</th>
          <th className="p-3">手机号</th>
          <th className="p-3">累计预约</th>
          <th className="p-3">最近一次</th>
        </tr>
      </thead>
      <tbody>
        {(data ?? []).map((m) => (
          <tr key={m.user_id} className="border-t border-white/5">
            <td className="p-3">{m.name}</td>
            <td className="p-3">
              <a href={`tel:${m.phone}`} className="font-mono text-xs text-brand hover:underline">{m.phone}</a>
            </td>
            <td className="p-3 font-display text-base font-bold text-brand">{m.total}</td>
            <td className="p-3 text-xs text-muted-foreground">
              {m.lastDate} · {COURSE_META[m.lastCourse as CourseType]?.label ?? m.lastCourse}
            </td>
          </tr>
        ))}
        {(data ?? []).length === 0 && (
          <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">暂无会员预约记录。</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "请求失败";
  return (
    <div className="border border-brand/40 bg-brand/5 p-6 text-sm text-brand">
      <p className="font-semibold">无法加载：{msg}</p>
      <p className="mt-2 text-xs text-muted-foreground">如果你不是教练，请前往 <Link to="/account" className="underline">会员中心</Link>。</p>
    </div>
  );
}
