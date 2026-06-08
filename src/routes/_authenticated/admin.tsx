import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Toaster, toast } from "sonner";
import {
  adminListMembers, adminAdjustCredits, adminListBookings, adminCancelBooking,
  adminListPurchaseRequests, adminResolvePurchase,
  adminListCoaches, adminAddCoachByPhone, adminRemoveCoach,
} from "@/lib/admin.functions";
import { claimAdminIfUnclaimed } from "@/lib/auth.functions";
import { adminListSchedules, adminUpsertSchedule, adminDeleteSchedule } from "@/lib/schedule-admin.functions";
import { adminGetCoachProfile, adminUpdateCoachProfile, uploadCoachAvatar } from "@/lib/coach-profile.functions";
import { COURSE_META, formatDateISO, WEEKDAY_LABELS, type CourseType } from "@/lib/schedule";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Tab = "members" | "coaches" | "schedule" | "bookings" | "purchases";

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
          {(["members", "coaches", "schedule", "bookings", "purchases"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"-mb-px border-b-2 px-1 py-4 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors " + (tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t === "members" ? "会员管理" : t === "coaches" ? "教练管理" : t === "schedule" ? "课表编辑" : t === "bookings" ? "预约总览" : "购买申请"}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        {tab === "members" && <MembersTab />}
        {tab === "coaches" && <CoachesTab />}
        {tab === "schedule" && <ScheduleTab />}
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
                {r.profile?.display_name ?? "—"}
                <span className="ml-2 font-mono text-xs text-muted-foreground">{r.profile?.phone}</span>
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

function CoachesTab() {
  const listFn = useServerFn(adminListCoaches);
  const addFn = useServerFn(adminAddCoachByPhone);
  const removeFn = useServerFn(adminRemoveCoach);
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "coaches"], queryFn: () => listFn(), retry: false });

  const addMut = useMutation({
    mutationFn: (p: string) => addFn({ data: { phone: p } }),
    onSuccess: () => { toast.success("已设为教练"); setPhone(""); qc.invalidateQueries({ queryKey: ["admin", "coaches"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "添加失败"),
  });

  const removeMut = useMutation({
    mutationFn: (uid: string) => removeFn({ data: { user_id: uid } }),
    onSuccess: () => { toast.success("已移除教练身份"); qc.invalidateQueries({ queryKey: ["admin", "coaches"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "移除失败"),
  });

  if (error) return <ErrorBanner error={error} />;

  return (
    <div className="space-y-8">
      <section className="border border-brand/40 bg-brand/5 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">Add Coach · 新增教练</p>
        <h2 className="mt-1 font-display text-xl font-bold italic">输入手机号将该会员设为教练</h2>
        <p className="mt-1 text-xs text-muted-foreground">该手机号需先以会员身份登录过一次工作室小程序（即数据库中已有 profile 记录）。设置成功后，该手机号下次登录将自动进入教练端。</p>
        <div className="mt-4 flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="tel"
            maxLength={11}
            placeholder="11 位手机号"
            className="input flex-1"
          />
          <button
            disabled={addMut.isPending || !/^1[3-9]\d{9}$/.test(phone)}
            onClick={() => addMut.mutate(phone)}
            className="bg-brand px-5 font-mono text-[11px] uppercase tracking-widest text-brand-foreground transition-colors hover:bg-foreground disabled:opacity-50"
          >
            {addMut.isPending ? "添加中…" : "设为教练"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">现有教练</h2>
        {isLoading ? <p className="text-muted-foreground">加载中…</p> : (
          <ul className="space-y-2">
            {(data ?? []).length === 0 && <p className="border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">暂无教练，使用上方表单添加。</p>}
            {(data ?? []).map((c) => (
              <li key={c.user_id} className="flex items-center justify-between border border-white/10 bg-card p-4">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{c.phone}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditId(c.user_id)}
                    className="border border-brand/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-brand hover:bg-brand/10"
                  >
                    编辑资料
                  </button>
                  <button
                    onClick={() => { if (confirm(`确认移除 ${c.name} 的教练身份？`)) removeMut.mutate(c.user_id); }}
                    className="border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-white/5 hover:text-brand"
                  >
                    移除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editId && <CoachEditDialog userId={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

function CoachEditDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const getFn = useServerFn(adminGetCoachProfile);
  const updateFn = useServerFn(adminUpdateCoachProfile);
  const uploadFn = useServerFn(uploadCoachAvatar);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "coach-profile", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
    retry: false,
  });

  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<CourseType[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setNickname(data.nickname ?? data.display_name ?? "");
    setBio(data.bio ?? "");
    setSpecialties((data.specialties ?? []) as CourseType[]);
    setAvatarUrl(data.avatar_signed_url ?? null);
  }, [data]);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await uploadFn({ data: { dataUrl: reader.result as string, target_user_id: userId } });
        setAvatarUrl(res.signedUrl);
        toast.success("头像已更新");
        qc.invalidateQueries({ queryKey: ["admin", "coach-profile", userId] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "上传失败");
      }
    };
    reader.readAsDataURL(file);
  };

  const onSave = async () => {
    if (!nickname.trim()) { toast.error("请输入姓名"); return; }
    setSaving(true);
    try {
      await updateFn({ data: { user_id: userId, nickname: nickname.trim(), bio, specialties } });
      toast.success("已保存");
      qc.invalidateQueries({ queryKey: ["admin", "coaches"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg border border-white/10 bg-background p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold italic">编辑教练资料</h3>
          <button onClick={onClose} className="font-mono text-xs text-muted-foreground hover:text-brand">✕</button>
        </div>
        {isLoading ? <p className="text-muted-foreground">加载中…</p> : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="size-20 overflow-hidden rounded-full border border-white/10 bg-card">
                {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-xs text-muted-foreground">无头像</div>}
              </div>
              <label className="cursor-pointer border border-brand/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-brand hover:bg-brand/10">
                上传头像
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">姓名 / 昵称</span>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">简介</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="input" placeholder="比如：8 年训练经验，擅长力量与体态调整..." />
            </label>
            <div>
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">擅长课种</span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(COURSE_META) as CourseType[]).map((ct) => {
                  const active = specialties.includes(ct);
                  return (
                    <button
                      key={ct}
                      onClick={() => setSpecialties((s) => active ? s.filter((x) => x !== ct) : [...s, ct])}
                      className={"border px-3 py-1.5 text-xs " + (active ? "border-brand bg-brand text-brand-foreground" : "border-white/10 text-muted-foreground hover:text-foreground")}
                    >
                      {COURSE_META[ct].label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="border border-white/10 px-4 py-2 font-mono text-xs text-muted-foreground hover:bg-white/5">取消</button>
              <button onClick={onSave} disabled={saving} className="bg-brand px-4 py-2 font-mono text-xs uppercase tracking-widest text-brand-foreground hover:bg-foreground disabled:opacity-50">{saving ? "保存中…" : "保存"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SCHEDULE_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function ScheduleTab() {
  const listFn = useServerFn(adminListSchedules);
  const coachesFn = useServerFn(adminListCoaches);
  const upsertFn = useServerFn(adminUpsertSchedule);
  const deleteFn = useServerFn(adminDeleteSchedule);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ weekday: number; hour: number; existing: Schedule | null } | null>(null);

  const { data: schedules, isLoading, error } = useQuery({
    queryKey: ["admin", "schedules"],
    queryFn: () => listFn(),
    retry: false,
  });
  const { data: coaches } = useQuery({ queryKey: ["admin", "coaches"], queryFn: () => coachesFn(), retry: false });

  const upsertMut = useMutation({
    mutationFn: (v: Parameters<typeof upsertFn>[0]["data"]) => upsertFn({ data: v }),
    onSuccess: () => { toast.success("已保存"); qc.invalidateQueries({ queryKey: ["admin", "schedules"] }); setEditing(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "保存失败"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("已删除"); qc.invalidateQueries({ queryKey: ["admin", "schedules"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "删除失败"),
  });

  if (error) return <ErrorBanner error={error} />;
  if (isLoading) return <p className="text-muted-foreground">加载中…</p>;

  // Schedule type defined at module scope
  const byCell = new Map<string, Schedule[]>();
  (schedules ?? []).forEach((s) => {
    const k = `${s.weekday}-${s.slot_hour}`;
    const arr = byCell.get(k) ?? [];
    arr.push(s);
    byCell.set(k, arr);
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">点击任意格子可新增、编辑或删除该时段的课程安排（课种 + 教练）。同一时段可安排多个课程（不同教练）。</p>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] border-collapse border border-white/10 text-xs">
          <thead>
            <tr className="bg-card">
              <th className="border border-white/10 p-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">时段</th>
              {WEEKDAY_LABELS.map((lbl, i) => (
                <th key={i} className="border border-white/10 p-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{lbl}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_HOURS.map((h) => (
              <tr key={h}>
                <td className="border border-white/10 bg-card p-2 text-center font-mono text-brand tabular-nums">{String(h).padStart(2,"0")}:00</td>
                {WEEKDAY_LABELS.map((_, weekday) => {
                  const entries = byCell.get(`${weekday}-${h}`) ?? [];
                  return (
                    <td key={weekday} className="border border-white/10 p-1.5 align-top hover:bg-white/[0.02]">
                      <button onClick={() => setEditing({ weekday, hour: h, existing: null })} className="block w-full text-left">
                        {entries.length === 0 ? (
                          <span className="block py-3 text-center text-muted-foreground/40">+</span>
                        ) : (
                          <div className="space-y-1">
                            {entries.map((e) => (
                              <div
                                key={e.id}
                                onClick={(ev) => { ev.stopPropagation(); setEditing({ weekday, hour: h, existing: e }); }}
                                className={"cursor-pointer border px-2 py-1.5 " + (e.is_active ? "border-brand/40 bg-brand/5" : "border-white/10 bg-white/[0.02] opacity-60")}
                              >
                                <p className="font-semibold">{COURSE_META[e.course_type as CourseType].label}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">{e.coach_name ?? "未指派"}{!e.is_active && " · 停用"}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ScheduleEditDialog
          weekday={editing.weekday}
          hour={editing.hour}
          existing={editing.existing}
          coaches={coaches ?? []}
          onClose={() => setEditing(null)}
          onSave={(v) => upsertMut.mutate(v)}
          onDelete={(id) => { if (confirm("确认删除该课表项？")) deleteMut.mutate(id); }}
        />
      )}
    </div>
  );
}

type Schedule = {
  id: string;
  weekday: number;
  slot_hour: number;
  course_type: CourseType;
  coach_id: string | null;
  is_active: boolean;
  coach_name: string | null;
};

function ScheduleEditDialog({
  weekday, hour, existing, coaches, onClose, onSave, onDelete,
}: {
  weekday: number;
  hour: number;
  existing: Schedule | null;
  coaches: { user_id: string; name: string }[];
  onClose: () => void;
  onSave: (v: { id?: string; weekday: number; slot_hour: number; course_type: CourseType; coach_id: string | null; is_active: boolean }) => void;
  onDelete: (id: string) => void;
}) {
  const [courseType, setCourseType] = useState<CourseType>(existing?.course_type ?? "private");
  const [coachId, setCoachId] = useState<string | null>(existing?.coach_id ?? null);
  const [isActive, setIsActive] = useState<boolean>(existing?.is_active ?? true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md border border-white/10 bg-background p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">{WEEKDAY_LABELS[weekday]} · {String(hour).padStart(2,"0")}:00</p>
          <h3 className="mt-1 font-display text-xl font-bold italic">{existing ? "编辑课程" : "新增课程"}</h3>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">课种</span>
            <select value={courseType} onChange={(e) => setCourseType(e.target.value as CourseType)} className="input">
              {(Object.keys(COURSE_META) as CourseType[]).map((ct) => (
                <option key={ct} value={ct}>{COURSE_META[ct].label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">教练</span>
            <select value={coachId ?? ""} onChange={(e) => setCoachId(e.target.value || null)} className="input">
              <option value="">— 未指派 —</option>
              {coaches.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>启用（关闭后会员看不到此时段）</span>
          </label>
        </div>

        <div className="mt-6 flex justify-between">
          <div>
            {existing && (
              <button onClick={() => onDelete(existing.id)} className="border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-red-400 hover:bg-red-500/10">
                删除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="border border-white/10 px-4 py-2 font-mono text-xs text-muted-foreground hover:bg-white/5">取消</button>
            <button
              onClick={() => onSave({ id: existing?.id, weekday, slot_hour: hour, course_type: courseType, coach_id: coachId, is_active: isActive })}
              className="bg-brand px-4 py-2 font-mono text-xs uppercase tracking-widest text-brand-foreground hover:bg-foreground"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
