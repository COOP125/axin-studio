import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

  const countsQuery = useQuery({
    queryKey: ["slot-counts", startISO, endISO],
    queryFn: () => fetchSlotCounts(startISO, endISO),
    staleTime: 30_000,
  });

  const countsMap = useMemo(() => {
    const m = new Map<string, number>();
    (countsQuery.data ?? []).forEach((c) => {
      m.set(`${c.slot_date}|${c.slot_hour}`, c.booked);
    });
    return m;
  }, [countsQuery.data]);

  const selectedDate = useMemo(() => {
    const d = new Date(selectedISO + "T00:00:00");
    return d;
  }, [selectedISO]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />

      {/* Nav */}
      <nav className="border-b border-hairline px-6 py-5 md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand">
              <span className="size-3 rounded-full bg-background" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              AXI STUDIO <span className="hidden text-muted-foreground sm:inline">/ 阿新工作室</span>
            </span>
          </a>
          <div className="hidden gap-8 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground md:flex">
            <a href="#schedule" className="hover:text-brand">课程预约</a>
            <a href="#about" className="hover:text-brand">关于阿新</a>
            <a href="#contact" className="hover:text-brand">联系我们</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
        {/* Hero */}
        <header className="mb-14 grid grid-cols-1 items-end gap-10 md:grid-cols-2">
          <div>
            <h1 className="font-display text-5xl font-bold uppercase italic leading-[0.95] text-foreground md:text-6xl lg:text-7xl">
              Precision <br />
              <span className="text-brand">Movement.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
              阿新的个人健身工作室，专注高效率的私教课程与科学训练体系。
              在这里，每一小时的付出都经过精确计算。
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              当前营业状态
            </p>
            <div className="mt-2 flex items-center gap-3 font-mono text-sm text-brand md:justify-end">
              <span className="relative inline-flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-brand" />
              </span>
              10:00 — 20:00 OPEN
            </div>
          </div>
        </header>

        {/* Course filter chips */}
        <div className="mb-8 flex flex-wrap gap-2.5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>全部课程</Chip>
          {(Object.keys(COURSE_META) as CourseType[]).map((ct) => (
            <Chip
              key={ct}
              active={filter === ct}
              onClick={() => setFilter(ct)}
            >
              {COURSE_META[ct].label}
            </Chip>
          ))}
        </div>

        <div id="schedule" className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Schedule column */}
          <div className="lg:col-span-8">
            {/* Day picker */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                本周排课 / Weekly Schedule
              </h3>
              <span className="font-mono text-[10px] text-muted-foreground">
                单节 60 分钟 · 整点开课
              </span>
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
                    className={
                      "group flex flex-col items-center gap-1 border py-3 transition-all " +
                      (isActive
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-white/5 bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground")
                    }
                  >
                    <span className="font-mono text-[10px] uppercase tracking-widest">
                      {weekdayLabel(d)}
                    </span>
                    <span className="font-display text-xl font-bold">
                      {d.getDate()}
                    </span>
                    {isToday && (
                      <span className={"font-mono text-[9px] uppercase tracking-widest " + (isActive ? "text-brand-foreground/60" : "text-brand")}>
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slots */}
            <div className="flex flex-col gap-1">
              {HOURS.map((hour, idx) => {
                const course = courseFor(selectedDate, hour);
                const meta = COURSE_META[course];
                const booked = countsMap.get(`${selectedISO}|${hour}`) ?? 0;
                const full = booked >= meta.capacity;
                const hidden = filter !== "all" && filter !== course;

                if (hidden) return null;

                return (
                  <div key={hour}>
                    {/* Inject lunch divider after 11:00 */}
                    {idx === 2 && (
                      <div className="my-1 flex items-center justify-center border-y border-white/5 bg-white/[0.015] p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground/60">
                          Lunch Break · 午间休整 · 12:00 — 13:00
                        </p>
                      </div>
                    )}
                    <SlotRow
                      hour={hour}
                      meta={meta}
                      booked={booked}
                      full={full}
                      onBook={() =>
                        setActiveSlot({
                          date: selectedISO,
                          hour,
                          course,
                          weekday: weekdayLabel(selectedDate),
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:col-span-4" id="about">
            <div className="rounded-tr-3xl rounded-bl-3xl bg-brand p-7 text-brand-foreground">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
                Head Coach
              </p>
              <h4 className="mt-1 font-display text-3xl font-bold">阿新 · A-Xin</h4>
              <p className="mt-4 italic leading-relaxed text-brand-foreground/75">
                "健身不只是雕刻肌肉，更是磨练意志。
                在我的工作室，每一小时都是为你量身打造。"
              </p>
              <img
                src={coachAxi}
                alt="阿新教练肖像"
                width={512}
                height={640}
                loading="lazy"
                className="mt-6 aspect-[4/5] w-full rounded-xl object-cover grayscale"
              />
            </div>

            <div className="border border-white/5 bg-card p-7">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
                课程定员
              </h4>
              <ul className="mt-4 space-y-3 text-sm">
                {(Object.keys(COURSE_META) as CourseType[]).map((ct) => (
                  <li key={ct} className="flex items-baseline justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">{COURSE_META[ct].label}</span>
                    <span className="font-mono text-foreground">
                      {COURSE_META[ct].capacity} 人
                    </span>
                  </li>
                ))}
                <li className="flex items-baseline justify-between pt-1">
                  <span className="text-muted-foreground">单节时长</span>
                  <span className="font-mono text-foreground">60 Min</span>
                </li>
              </ul>
            </div>

            <div id="contact" className="border border-white/5 bg-card p-7">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
                联系工作室
              </h4>
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
            <a href="#" className="hover:text-brand">WeChat</a>
            <a href="#" className="hover:text-brand">RedBook</a>
            <a href="#" className="hover:text-brand">Instagram</a>
          </div>
        </div>
      </footer>

      <BookingDialog
        open={!!activeSlot}
        onClose={() => setActiveSlot(null)}
        slot={activeSlot}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-5 py-2 text-xs font-bold transition-colors " +
        (active
          ? "bg-brand text-brand-foreground"
          : "border border-white/5 bg-card text-muted-foreground hover:border-brand/50 hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function SlotRow({
  hour,
  meta,
  booked,
  full,
  onBook,
}: {
  hour: number;
  meta: { label: string; english: string; capacity: number };
  booked: number;
  full: boolean;
  onBook: () => void;
}) {
  const accent = full
    ? "border-l-white/10"
    : booked > 0
      ? "border-l-brand"
      : "border-l-brand/20";

  return (
    <div
      className={
        "group flex flex-col items-stretch gap-4 border-l-4 bg-card p-5 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6 " +
        accent
      }
    >
      <div className="flex items-center gap-6">
        <span className="font-display text-2xl font-bold tabular-nums text-foreground">
          {String(hour).padStart(2, "0")}:00
        </span>
        <div>
          <p className="font-semibold text-foreground">{meta.label}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {meta.english}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5 sm:gap-6">
        <CapacityIndicator booked={booked} capacity={meta.capacity} />
        <button
          onClick={onBook}
          disabled={full}
          className={
            "px-5 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors " +
            (full
              ? "cursor-not-allowed bg-white/5 text-muted-foreground"
              : "bg-brand text-brand-foreground hover:bg-foreground")
          }
        >
          {full ? "预约已满" : "即刻预约"}
        </button>
      </div>
    </div>
  );
}

function CapacityIndicator({ booked, capacity }: { booked: number; capacity: number }) {
  const full = booked >= capacity;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className={"font-mono text-[10px] tabular-nums " + (full ? "text-muted-foreground" : "text-brand")}>
        {booked}/{capacity}
      </span>
      <div className="flex gap-0.5">
        {Array.from({ length: capacity }).map((_, i) => (
          <span
            key={i}
            className={
              "h-1 w-3 " + (i < booked ? (full ? "bg-white/30" : "bg-brand") : "bg-white/10")
            }
          />
        ))}
      </div>
    </div>
  );
}
