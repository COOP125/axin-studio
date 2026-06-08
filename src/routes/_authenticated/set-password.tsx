import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster, toast } from "sonner";
import { getMyStatus, setMyPassword } from "@/lib/password.functions";
import { PASSWORD_RE, PASSWORD_HINT } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/set-password")({
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const statusFn = useServerFn(getMyStatus);
  const setFn = useServerFn(setMyPassword);
  const { data: status } = useQuery({ queryKey: ["my-status"], queryFn: () => statusFn(), retry: false });

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PASSWORD_RE.test(pw1)) { toast.error(PASSWORD_HINT); return; }
    if (pw1 !== pw2) { toast.error("两次输入不一致"); return; }
    setSubmitting(true);
    try {
      await setFn({ data: { password: pw1 } });
      toast.success("密码已设置");
      // 按角色跳转
      const roles = status?.roles ?? [];
      const dest = roles.includes("admin") ? "/admin" : roles.includes("coach") ? "/coach" : "/account";
      navigate({ to: dest as "/account" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "设置失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />
      <main className="mx-auto flex max-w-md flex-col px-6 py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">First-Time Setup</p>
        <h1 className="mt-2 font-display text-4xl font-bold italic">设置登录密码</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          为了方便下次登录，请为账户 <span className="font-mono text-foreground">{status?.phone ?? "—"}</span> 设置一个密码。
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{PASSWORD_HINT}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">新密码</span>
            <input value={pw1} onChange={(e) => setPw1(e.target.value)} type="password" autoComplete="new-password" className="input" placeholder="至少 6 位" />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">再次确认</span>
            <input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" autoComplete="new-password" className="input" placeholder="再次输入" />
          </label>
          <button type="submit" disabled={submitting} className="w-full bg-brand px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-foreground transition-colors hover:bg-foreground disabled:opacity-50">
            {submitting ? "保存中…" : "保存并继续"}
          </button>
        </form>
      </main>
    </div>
  );
}
