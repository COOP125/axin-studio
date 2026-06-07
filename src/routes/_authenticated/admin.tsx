import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Toaster, toast } from "sonner";
import {
  adminListMembers, adminAdjustCredits, adminListBookings, adminCancelBooking,
  adminListPurchaseRequests, adminResolvePurchase,
} from "@/lib/admin.functions";
import { claimAdminIfUnclaimed } from "@/lib/auth.functions";
import { COURSE_META, formatDateISO, type CourseType } from "@/lib/schedule";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Tab = "members" | "bookings" | "purchases";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("members");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const claimFn = useServerFn(claimAdminIfUnclaimed);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const claim = async () => {
    try {
      await claimFn();
      toast.success("已认领为教练账户，刷新中…");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "认领失败");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />

      <nav className="border-b border-hairline px-6 py-5 md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand"><span className="size-3 rounded-full bg-background" /></span>
            <span className="font-display text-lg font-bold tracking-tight">AXI STUDIO / 教练后台</span>
          </Link>
          <div className="flex items-center gap-4">
            <button onClick={claim} className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-brand">初始化身份</button>
            <button onClick={signOut} className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-brand">退出</button>
          </div>
        </div>
      </nav>

      <div className="border-b border-hairline px-6 md:px-10">
        <div className="mx-auto flex max-w-7xl gap-6">
          {(["members", "bookings", "purchases"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"-mb-px border-b-2 px-1 py-4 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors " + (tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t === "members" ? "会员管理" : t === "bookings" ? "预约总览" : "购买申请"}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        {tab === "members" && <MembersTab />}
        {tab === "bookings" && <BookingsTab />}
        {tab === "purchases" && <PurchasesTab />}
      </main>
    </div>
  );
}

function MembersTab() {
  const fetchFn = useServerFn(adminListMembers);
  const adjustFn = useServerFn(adminAdjustCredits);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "members"], queryFn: () => fetchFn(), retry: false });

  const adjustMut = useMutation({
    mutationFn: (v: { user_id: string; course_type: CourseType; delta: number; reason: string }) => adjustFn({ data: v }),
    onSuccess: () => { toast.success("已调整"); qc.invalidateQueries({ queryKey: ["admin", "members"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "调整失败"),
  });

  if (isLoading) return <p className="text-muted-foreground">加载中…</p>;
  if (error) return <ErrorBanner error={error} />;

  return (
    <div className="space-y-3">
      {(data ?? []).length === 0 && <p className="text-muted-foreground">暂无会员。</p>}
      {(data ?? []).map((m) => (
        <div key={m.user_id} className="border border-white/10 bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-display text-lg font-bold">{m.display_name ?? "未命名"}</p>
              <p className="font-mono text-xs text-muted-foreground">{m.phone} · 累计预约 {m.bookingCount} 次</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(Object.keys(COURSE_META) as CourseType[]).map((ct) => (
              <CreditAdjuster
                key={ct}
                label={COURSE_META[ct].label}
                remaining={m.credits[ct] ?? 0}
                onAdjust={(delta) => {
                  const reason = prompt(`调整原因（${COURSE_META[ct].label} ${delta > 0 ? "+" : ""}${delta}）`, delta > 0 ? "线下充值" : "线下扣减");
                  if (!reason) return;
                  adjustMut.mutate({ user_id: m.user_id, course_type: ct, delta, reason });
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreditAdjuster({ label, remaining, onAdjust }: { label: string; remaining: number; onAdjust: (delta: number) => void }) {
  return (
    <div className="border border-white/5 bg-background p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="my-1 font-display text-2xl font-bold text-brand">{remaining}</p>
      <div className="flex gap-1">
        <button onClick={() => onAdjust(-1)} className="flex-1 border border-white/10 py-1 font-mono text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground">−1</button>
        <button onClick={() => onAdjust(1)} className="flex-1 border border-white/10 py-1 font-mono text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground">+1</button>
        <button onClick={() => onAdjust(10)} className="flex-1 border border-brand/40 bg-brand/10 py-1 font-mono text-xs text-brand hover:bg-brand/20">+10</button>
      </div>
    </div>
  );
}

function BookingsTab() {
  const today = useMemo(() => new Date(), []);
  const [start, setStart] = useState(formatDateISO(today));
  const [end, setEnd] = useState(formatDateISO(new Date(today.getTime() + 7 * 86400000)));
  const fetchFn = useServerFn(adminListBookings);
  const cancelFn = useServerFn(adminCancelBooking);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "bookings", start, end],
    queryFn: () => fetchFn({ data: { start, end } }),
    retry: false,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { toast.success("已代客取消"); qc.invalidateQueries({ queryKey: ["admin", "bookings"] }); qc.invalidateQueries({ queryKey: ["slot-counts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "取消失败"),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-4">
        <label className="text-sm text-muted-foreground">
          起 <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input ml-2 inline-block w-auto" />
        </label>
        <label className="text-sm text-muted-foreground">
          止 <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input ml-2 inline-block w-auto" />
        </label>
      </div>
      {isLoading ? <p className="text-muted-foreground">加载中…</p> : error ? <ErrorBanner error={error} /> : (
        <table className="w-full border border-white/10 text-sm">
          <thead className="bg-card text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3">日期</th><th className="p-3">时段</th><th className="p-3">课程</th>
              <th className="p-3">姓名</th><th className="p-3">手机</th><th className="p-3">备注</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <td className="p-3 tabular-nums">{b.slot_date}</td>
                <td className="p-3 font-mono text-brand">{String(b.slot_hour).padStart(2,"0")}:00</td>
                <td className="p-3">{COURSE_META[b.course_type as CourseType].label} {b.is_trial && <span className="ml-1 rounded bg-brand/20 px-1 font-mono text-[9px] text-brand">体验</span>}</td>
                <td className="p-3">{b.customer_name}</td>
                <td className="p-3 font-mono text-xs">{b.customer_phone}</td>
                <td className="p-3 text-xs text-muted-foreground">{b.note ?? "—"}</td>
                <td className="p-3"><button onClick={() => { if (confirm("确认取消该预约？")) cancelMut.mutate(b.id); }} className="font-mono text-[10px] uppercase text-muted-foreground hover:text-brand">取消</button></td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">此时间段暂无预约。</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PurchasesTab() {
  const fetchFn = useServerFn(adminListPurchaseRequests);
  const resolveFn = useServerFn(adminResolvePurchase);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "purchases"], queryFn: () => fetchFn(), retry: false });
  const resolveMut = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => resolveFn({ data: v }),
    onSuccess: (_d, v) => { toast.success(v.approve ? "已确认收款并充值" : "已拒绝"); qc.invalidateQueries({ queryKey: ["admin", "purchases"] }); qc.invalidateQueries({ queryKey: ["admin", "members"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "失败"),
  });

  if (isLoading) return <p className="text-muted-foreground">加载中…</p>;
  if (error) return <ErrorBanner error={error} />;

  return (
    <ul className="space-y-2">
      {(data ?? []).length === 0 && <p className="text-muted-foreground">暂无购买申请。</p>}
      {(data ?? []).map((r) => {
        const meta = COURSE_META[r.course_type as CourseType];
        return (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-card p-4">
            <div>
              <p className="text-sm font-semibold">
                {(r as { profiles?: { display_name?: string; phone: string } }).profiles?.display_name ?? "—"}
                <span className="ml-2 font-mono text-xs text-muted-foreground">{(r as { profiles?: { phone: string } }).profiles?.phone}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {meta.label} × {r.quantity} 节 · ¥{r.unit_price}/节 · 共 ¥{r.unit_price * r.quantity}
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("zh-CN")} · 状态：{r.status}</p>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => resolveMut.mutate({ id: r.id, approve: false })} className="border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground hover:bg-white/5">拒绝</button>
                <button onClick={() => resolveMut.mutate({ id: r.id, approve: true })} className="bg-brand px-3 py-1.5 font-mono text-[10px] uppercase text-brand-foreground hover:bg-foreground">已收款 · 充值</button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "请求失败";
  return (
    <div className="border border-brand/40 bg-brand/5 p-6 text-sm text-brand">
      <p className="font-semibold">无法加载：{msg}</p>
      <p className="mt-2 text-xs text-muted-foreground">如果是首次登录教练账户，请点击右上角的「初始化身份」按钮认领教练权限。</p>
    </div>
  );
}
