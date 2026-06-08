import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requestOtp, verifyOtp, coachSignIn } from "@/lib/auth.functions";
import { isChinaMobile } from "@/lib/schedule";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/account",
    mode: s.mode === "coach" ? ("coach" as const) : ("member" as const),
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect as "/account" });
  },
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"member" | "coach">(search.mode);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />
      <header className="border-b border-hairline px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand">
              <span className="size-3 rounded-full bg-background" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">AXI STUDIO</span>
          </Link>
          <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-brand">
            ← 返回首页
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-6 py-16">
        <h1 className="font-display text-4xl font-bold italic">
          {tab === "member" ? "会员登录" : "教练登录"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tab === "member" ? "凭手机号 + 验证码登录会员账户" : "凭固定账号 + 密码进入教练后台"}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-0 border border-white/10">
          <TabBtn active={tab === "member"} onClick={() => setTab("member")}>会员</TabBtn>
          <TabBtn active={tab === "coach"} onClick={() => setTab("coach")}>教练</TabBtn>
        </div>

        <div className="mt-6">
          {tab === "member" ? <MemberLoginForm onDone={() => navigate({ to: search.redirect as "/account" })} /> : <CoachLoginForm onDone={() => navigate({ to: "/admin" })} />}
        </div>
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={"px-4 py-3 font-mono text-xs uppercase tracking-widest transition-colors " + (active ? "bg-brand text-brand-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
    >
      {children}
    </button>
  );
}

function MemberLoginForm({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const requestFn = useServerFn(requestOtp);
  const verifyFn = useServerFn(verifyOtp);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onSendCode = async () => {
    const normalized = phone.replace(/\D/g, "");
    if (!isChinaMobile(normalized)) { toast.error("请输入有效的中国大陆手机号"); return; }
    try {
      await requestFn({ data: { phone: normalized } });
      setCooldown(60);
      toast.success("验证码已发送，请查收短信");

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发送失败");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = phone.replace(/\D/g, "");
    if (!isChinaMobile(normalized)) { toast.error("手机号格式有误"); return; }
    if (!/^\d{6}$/.test(code)) { toast.error("请输入 6 位验证码"); return; }
    setSubmitting(true);
    try {
      const { tokenHash } = await verifyFn({ data: { phone: normalized, code } });
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error) throw error;
      toast.success("登录成功");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">手机号</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          maxLength={11}
          className="input"
          placeholder="11 位手机号"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">验证码</span>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            className="input flex-1"
            placeholder="6 位验证码"
          />
          <button
            type="button"
            onClick={onSendCode}
            disabled={cooldown > 0}
            className="border border-brand/40 px-4 text-xs font-bold uppercase tracking-widest text-brand transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-40"
          >
            {cooldown > 0 ? `${cooldown}s` : "获取验证码"}
          </button>
        </div>
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-foreground transition-colors hover:bg-foreground disabled:opacity-50"
      >
        {submitting ? "登录中…" : "登录 / 注册"}
      </button>
      <p className="text-center text-[10px] text-muted-foreground/70">
        登录即表示同意《用户协议》与《隐私政策》
      </p>
    </form>
  );
}

function CoachLoginForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("AXI-Studio");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const coachSignInFn = useServerFn(coachSignIn);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { email, password: pw } = await coachSignInFn({ data: { username, password } });
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (signInErr) throw signInErr;
      toast.success("登录成功");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">账号</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="input" placeholder="AXI-Studio" />
      </label>
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">密码</span>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" className="input" placeholder="请输入密码" />
      </label>
      <button type="submit" disabled={submitting} className="w-full bg-brand px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-foreground transition-colors hover:bg-foreground disabled:opacity-50">
        {submitting ? "登录中…" : "登录教练后台"}
      </button>
      <p className="rounded-md border border-brand/20 bg-brand/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
        教练账号为固定账号，仅限工作室运营者使用。
      </p>
    </form>
  );
}
