import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Toaster } from "sonner";
import coachAxi from "@/assets/coach-axi.jpg";
import {
  COURSE_META,
  HOURS,
  courseFor,
  formatDateISO,
  weekDays,
  weekdayLabel,
  type CourseType,
} from "@/lib/schedule";
import { fetchSlotCounts } from "@/lib/booking.api";
import { BookingDialog } from "@/components/BookingDialog";
import { useAuth } from "@/hooks/useAuth";
import { getMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

interface ActiveSlot {
  date: string;
  hour: number;
  course: CourseType;
  weekday: string;
}

function Index() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const days = useMemo(() => weekDays(today, 7), [today]);

  const [selectedISO, setSelectedISO] = useState(formatDateISO(today));
  const [filter, setFilter] = useState<CourseType | "all">("all");
  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>(null);

  const startISO = formatDateISO(days[0]);
  const endISO = formatDateISO(days[days.length - 1]);

  const auth = useAuth();
  const accountFn = useServerFn(getMyAccount);
  const accountQuery = useQuery({
    queryKey: ["account"],
    queryFn: () => accountFn(),
    enabled: !!auth.user,
  });

  const countsQuery = useQuery({
    queryKey: ["slot-counts", startISO, endISO],
    queryFn: () => fetchSlotCounts(startISO, endISO),
    staleTime: 30_000,
  });

  const countsMap = useMemo(() => {
    const m = new Map<string, number>();
    (countsQuery.data ?? []).forEach((c) => m.set(`${c.slot_date}|${c.slot_hour}`, c.booked));
    return m;
  }, [countsQuery.data]);

  const selectedDate = useMemo(() => new Date(selectedISO + "T00:00:00"), [selectedISO]);
  const mode: "trial" | "member" = auth.user ? "member" : "trial";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />

      <nav className="border-b border-hairline px-6 py-5 md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand">
              <span className="size-3 rounded-full bg-background" />
            </span>
            <span className="font-display text-base font-bold tracking-tight md:text-lg">
              AXI STUDIO <span className="hidden text-muted-foreground sm:inline">/ 阿新工作室</span>
            </span>
          </a>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden gap-8 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground md:flex">
              <a href="#schedule" className="hover:text-brand">课程</a>
              <a href="#about" className="hover:text-brand">关于</a>
            </div>
            {auth.user ? (
              <Link to="/account" className="flex items-center gap-2 border border-brand/40 bg-brand/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-brand transition-colors hover:bg-brand hover:text-brand-foreground">
                会员中心
              </Link>
            ) : (
              <Link to="/auth" search={{ redirect: "/account", mode: "member" }} className="border border-brand/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-brand transition-colors hover:bg-brand hover:text-brand-foreground">
                会员登录
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
        <header className="mb-14 grid grid-cols-1 items-end gap-10 md:grid-cols-2">
          <div>
            <h1 className="font-display text-5xl font-bold uppercase italic leading-[0.95] text-foreground md:text-6xl lg:text-7xl">
              Strong is <br />
              <span className="text-brand">Beautiful.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
              阿新的个人健身工作室 — 由专业女教练带你科学训练。
              力量、有氧、塑形、应试。每一节课，遇见更好的自己。
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">当前营业状态</p>
            <div className="mt-2 flex items-center gap-3 font-mono text-sm text-brand md:justify-end">
              <span className="relative inline-flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-brand" />
              </span>
              10:00 — 20:00 OPEN
            </div>
          </div>
        </header>

        {/* Booking mode banner */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-brand bg-card p-4">
          {mode === "trial" ? (
            <>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">Trial Mode · 体验预约</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  当前为访客模式，可免费预约一次<strong className="text-foreground">团操课</strong>或<strong className="text-foreground">有氧课</strong>。其他课程请先<Link to="/auth" search={{ redirect: "/account", mode: "member" }} className="text-brand hover:underline">登录会员账户</Link>。
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">Member Mode · 会员预约</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  欢迎回来，{accountQuery.data?.profile?.display_name ?? "会员"}！
                </p>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-[10px]">
                {(accountQuery.data?.credits ?? []).map((c) => {
                  const meta = COURSE_META[c.course_type as CourseType];
                  return (
                    <span key={c.course_type} className="flex items-center gap-1 border border-white/10 bg-background px-2 py-1 text-muted-foreground">
                      {meta.label} <span className="font-bold text-brand">{c.remaining}</span>
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="mb-8 flex flex-wrap gap-2.5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>全部课程</Chip>
          {(Object.keys(COURSE_META) as CourseType[]).map((ct) => (
            <Chip key={ct} active={filter === ct} onClick={() => setFilter(ct)}>
              {COURSE_META[ct].label}
            </Chip>
          ))}
        </div>

        <div id="schedule" className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">本周排课 / Weekly Schedule</h3>
              <span className="font-mono text-[10px] text-muted-foreground">单节 60 分钟 · 整点开课</span>
            </div>
            <div className="mb-6 grid grid-cols-7 gap-1">
              {days.map((d) => {
                const iso = formatDateISO(d);
                const isActive = iso === selectedISO;
                const isToday = iso === formatDateISO(today);
                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedISO(iso)}
                    className={"group flex flex-col items-center gap-1 border py-3 transition-all " + (isActive ? "border-brand bg-brand text-brand-foreground" : "border-white/5 bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground")}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-widest">{weekdayLabel(d)}</span>
                    <span className="font-display text-xl font-bold">{d.getDate()}</span>
                    {isToday && <span className={"font-mono text-[9px] uppercase tracking-widest " + (isActive ? "text-brand-foreground/60" : "text-brand")}>Today</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1">
              {HOURS.map((hour, idx) => {
                const course = courseFor(selectedDate, hour);
                const meta = COURSE_META[course];
                const booked = countsMap.get(`${selectedISO}|${hour}`) ?? 0;
                const full = booked >= meta.capacity;
                const hidden = filter !== "all" && filter !== course;
                if (hidden) return null;
                const trialBlocked = mode === "trial" && !meta.trialAllowed;
                return (
                  <div key={hour}>
                    {idx === 2 && (
                      <div className="my-1 flex items-center justify-center border-y border-white/5 bg-white/[0.015] p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground/60">Lunch Break · 午间休整 · 12:00 — 13:00</p>
                      </div>
                    )}
                    <SlotRow
                      hour={hour}
                      meta={meta}
                      booked={booked}
                      full={full}
                      trialBlocked={trialBlocked}
                      onBook={() => setActiveSlot({ date: selectedISO, hour, course, weekday: weekdayLabel(selectedDate) })}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="space-y-6 lg:col-span-4" id="about">
            <div className="rounded-tr-3xl rounded-bl-3xl bg-brand p-7 text-brand-foreground">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">Head Coach</p>
              <h4 className="mt-1 font-display text-3xl font-bold">阿新 · A-Xin</h4>
              <p className="mt-4 italic leading-relaxed text-brand-foreground/75">
                "训练是与自己最诚实的对话 — 我陪你听见身体的声音，再让它变得更强。"
              </p>
              <img src={coachAxi} alt="阿新教练肖像" width={832} height={1024} loading="lazy" className="mt-6 aspect-[4/5] w-full rounded-xl object-cover" />
            </div>

            <div className="border border-white/5 bg-card p-7">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">课程定价</h4>
              <ul className="mt-4 space-y-3 text-sm">
                {(Object.keys(COURSE_META) as CourseType[]).map((ct) => (
                  <li key={ct} className="flex items-baseline justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">{COURSE_META[ct].label}<span className="ml-2 font-mono text-[10px] text-muted-foreground/60">{COURSE_META[ct].capacity}人</span></span>
                    <span className="font-mono text-foreground">¥{COURSE_META[ct].price}<span className="ml-1 text-[10px] text-muted-foreground">/节</span></span>
                  </li>
                ))}
              </ul>
            </div>

            <div id="contact" className="border border-white/5 bg-card p-7">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">联系工作室</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>营业时间 · 10:00 – 20:00</li>
                <li>电话预约 · 138 0000 0000</li>
                <li>微信 / 小红书 · @axi_studio</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <footer className="mt-20 border-t border-hairline px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} AXI PERSONAL STUDIO · ALL RIGHTS RESERVED</div>
          <div className="flex gap-6">
            <Link to="/auth" search={{ redirect: "/admin", mode: "coach" }} className="hover:text-brand">教练入口</Link>
            <a href="#" className="hover:text-brand">WeChat</a>
            <a href="#" className="hover:text-brand">RedBook</a>
          </div>
        </div>
      </footer>

      <BookingDialog
        open={!!activeSlot}
        onClose={() => setActiveSlot(null)}
        slot={activeSlot}
        mode={mode}
        memberPhone={accountQuery.data?.profile?.phone ?? undefined}
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={"rounded-full px-5 py-2 text-xs font-bold transition-colors " + (active ? "bg-brand text-brand-foreground" : "border border-white/5 bg-card text-muted-foreground hover:border-brand/50 hover:text-foreground")}
    >
      {children}
    </button>
  );
}

function SlotRow({ hour, meta, booked, full, trialBlocked, onBook }: { hour: number; meta: { label: string; english: string; capacity: number }; booked: number; full: boolean; trialBlocked: boolean; onBook: () => void }) {
  const accent = full ? "border-l-white/10" : booked > 0 ? "border-l-brand" : "border-l-brand/20";
  const disabled = full || trialBlocked;
  return (
    <div className={"group flex flex-col items-stretch gap-4 border-l-4 bg-card p-5 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6 " + accent}>
      <div className="flex items-center gap-6">
        <span className="font-display text-2xl font-bold tabular-nums text-foreground">{String(hour).padStart(2, "0")}:00</span>
        <div>
          <p className="font-semibold text-foreground">{meta.label}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{meta.english}</p>
        </div>
      </div>
      <div className="flex items-center gap-5 sm:gap-6">
        <CapacityIndicator booked={booked} capacity={meta.capacity} />
        <button
          onClick={onBook}
          disabled={disabled}
          title={trialBlocked ? "该课程仅限会员预约" : ""}
          className={"px-5 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors " + (disabled ? "cursor-not-allowed bg-white/5 text-muted-foreground" : "bg-brand text-brand-foreground hover:bg-foreground")}
        >
          {full ? "预约已满" : trialBlocked ? "仅限会员" : "即刻预约"}
        </button>
      </div>
    </div>
  );
}

function CapacityIndicator({ booked, capacity }: { booked: number; capacity: number }) {
  const full = booked >= capacity;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className={"font-mono text-[10px] tabular-nums " + (full ? "text-muted-foreground" : "text-brand")}>{booked}/{capacity}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: capacity }).map((_, i) => (
          <span key={i} className={"h-1 w-3 " + (i < booked ? (full ? "bg-white/30" : "bg-brand") : "bg-white/10")} />
        ))}
      </div>
    </div>
  );
}
