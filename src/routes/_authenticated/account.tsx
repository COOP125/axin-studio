import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { getMyAccount, cancelMyBooking, createPurchaseRequest, requestTrialUpgrade } from "@/lib/account.functions";
import { COURSE_META, type CourseType } from "@/lib/schedule";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import wechatPayQr from "@/assets/wechat-pay-qr.asset.json";
import alipayPayQr from "@/assets/alipay-pay-qr.asset.json";


export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const fetchAccount = useServerFn(getMyAccount);
  const cancelFn = useServerFn(cancelMyBooking);
  const purchaseFn = useServerFn(createPurchaseRequest);
  const trialUpgradeFn = useServerFn(requestTrialUpgrade);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [trialOpen, setTrialOpen] = useState<null | "group" | "cardio">(null);


  const { data, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchAccount(),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { toast.success("已取消，课次已返还"); qc.invalidateQueries({ queryKey: ["account"] }); qc.invalidateQueries({ queryKey: ["slot-counts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "取消失败"),
  });

  const purchaseMut = useMutation({
    mutationFn: (v: { course_type: CourseType; quantity: number; unit_price: number }) => purchaseFn({ data: v }),
    onSuccess: () => { toast.success("购买申请已提交，请联系教练完成支付。"); qc.invalidateQueries({ queryKey: ["account"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "提交失败"),
  });

  const trialUpgradeMut = useMutation({
    mutationFn: (ct: "group" | "cardio") => trialUpgradeFn({ data: { course_type: ct } }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("已提交！教练确认后将立即添加 1 节课次。");
      setTrialOpen(null);
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "提交失败"),
  });


  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">加载中…</div>;

  const upcoming = (data?.bookings ?? []).filter((b) => {
    const d = new Date(b.slot_date + "T00:00:00");
    d.setHours(b.slot_hour);
    return d.getTime() >= Date.now() - 60 * 60 * 1000;
  });
  const history = (data?.bookings ?? []).filter((b) => !upcoming.includes(b));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />

      <nav className="border-b border-hairline px-6 py-5 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand"><span className="size-3 rounded-full bg-background" /></span>
            <span className="font-display text-lg font-bold tracking-tight">AXI STUDIO / 会员中心</span>
          </Link>
          <div className="flex items-center gap-4">
            {data?.isAdmin && (
              <Link to="/admin" className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand hover:underline">教练后台 →</Link>
            )}
            <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-brand">去预约</Link>
            <button onClick={signOut} className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-brand">退出</button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-12 md:px-10">
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">My Profile</p>
          <h1 className="mt-1 font-display text-4xl font-bold italic">
            {data?.profile?.display_name ?? "新会员"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">手机：{data?.profile?.phone}</p>
        </section>

        <section>
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">剩余课次 / Remaining Credits</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(data?.credits ?? []).map((c) => {
              const meta = COURSE_META[c.course_type as CourseType];
              return (
                <div key={c.course_type} className="border border-white/10 bg-card p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{meta.english}</p>
                  <p className="mt-1 text-sm text-foreground">{meta.label}</p>
                  <p className="mt-3 font-display text-4xl font-bold text-brand">{c.remaining}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">节剩余</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border border-brand/40 bg-brand/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">Welcome Offer · 1 元加购</p>
              <h2 className="mt-1 font-display text-2xl font-bold italic">¥1 再加 1 节体验课</h2>
              <p className="mt-1 text-sm text-muted-foreground">仅限新会员一次，可选 团操课 或 有氧 Cardio</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTrialOpen("group")} className="border border-brand bg-brand px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-brand-foreground transition-colors hover:bg-foreground">+1 团操课</button>
              <button onClick={() => setTrialOpen("cardio")} className="border border-brand px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-brand transition-colors hover:bg-brand hover:text-brand-foreground">+1 Cardio</button>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">购买课程 / Purchase</h2>
            <span className="font-mono text-[10px] text-muted-foreground">点击「申请购买」后教练会与您联系收款</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(Object.keys(COURSE_META) as CourseType[]).map((ct) => (
              <PurchaseCard key={ct} courseType={ct} onSubmit={(qty) => purchaseMut.mutate({ course_type: ct, quantity: qty, unit_price: COURSE_META[ct].price })} pending={purchaseMut.isPending} />
            ))}
          </div>
        </section>


        <section>
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">我的预约 · 即将到来</h2>
          {upcoming.length === 0 ? (
            <p className="border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">暂无预约，<Link to="/" className="text-brand hover:underline">去预约 →</Link></p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((b) => (
                <BookingRow key={b.id} booking={b} canCancel onCancel={() => cancelMut.mutate(b.id)} />
              ))}
            </ul>
          )}
        </section>

        {history.length > 0 && (
          <section>
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">历史记录</h2>
            <ul className="space-y-2">
              {history.slice(0, 20).map((b) => <BookingRow key={b.id} booking={b} />)}
            </ul>
          </section>
        )}
      </main>

      {trialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => !trialUpgradeMut.isPending && setTrialOpen(null)}>
          <div className="w-full max-w-sm border border-white/10 bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">Scan to Pay · ¥1</p>
            <h3 className="mt-1 font-display text-2xl font-bold italic">{trialOpen === "group" ? "团操课" : "Cardio 有氧"} · +1 节</h3>
            <p className="mt-1 text-xs text-muted-foreground">使用微信或支付宝扫码支付 1 元后，点击下方按钮提交，教练核对后将立即添加 1 节课次。</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center bg-white p-3">
                <img src={wechatPayQr.url} alt="微信支付收款码" className="h-40 w-auto object-contain" />
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-black">WeChat Pay</p>
              </div>
              <div className="flex flex-col items-center bg-white p-3">
                <img src={alipayPayQr.url} alt="支付宝收款码" className="h-40 w-auto object-contain" />
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-black">Alipay</p>
              </div>
            </div>
            <button
              disabled={trialUpgradeMut.isPending}
              onClick={() => trialUpgradeMut.mutate(trialOpen)}
              className="mt-4 w-full bg-brand py-3 font-mono text-[11px] uppercase tracking-widest text-brand-foreground transition-colors hover:bg-foreground disabled:opacity-50"
            >
              {trialUpgradeMut.isPending ? "提交中…" : "我已支付 · 提交申请"}
            </button>
            <button onClick={() => setTrialOpen(null)} disabled={trialUpgradeMut.isPending} className="mt-2 w-full py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-brand">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function BookingRow({ booking, canCancel, onCancel }: { booking: { id: string; slot_date: string; slot_hour: number; course_type: string; is_trial: boolean }; canCancel?: boolean; onCancel?: () => void }) {
  const meta = COURSE_META[booking.course_type as CourseType];
  return (
    <li className="flex items-center justify-between border border-white/10 bg-card p-4">
      <div className="flex items-center gap-4">
        <span className="font-display text-xl font-bold tabular-nums">{String(booking.slot_hour).padStart(2, "0")}:00</span>
        <div>
          <p className="text-sm font-semibold">{meta.label} {booking.is_trial && <span className="ml-2 rounded bg-brand/20 px-1.5 py-0.5 font-mono text-[9px] text-brand">体验</span>}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{booking.slot_date}</p>
        </div>
      </div>
      {canCancel && (
        <button onClick={onCancel} className="border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-white/5 hover:text-brand">
          取消
        </button>
      )}
    </li>
  );
}

function PurchaseCard({ courseType, onSubmit, pending }: { courseType: CourseType; onSubmit: (qty: number) => void; pending: boolean }) {
  const [qty, setQty] = useState(1);
  const meta = COURSE_META[courseType];
  return (
    <div className="flex items-center justify-between border border-white/10 bg-card p-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{meta.english}</p>
        <p className="mt-1 text-sm font-semibold">{meta.label}</p>
        <p className="mt-2 font-display text-2xl font-bold text-brand">¥{meta.price}<span className="ml-1 text-xs text-muted-foreground">/节</span></p>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={1} max={50} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="input w-16 text-center" />
        <button onClick={() => onSubmit(qty)} disabled={pending} className="bg-brand px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-brand-foreground transition-colors hover:bg-foreground disabled:opacity-50">
          申请购买
        </button>
      </div>
    </div>
  );
}
