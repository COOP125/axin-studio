import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyStatus } from "@/lib/password.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname, mode: "member" } });
    }
    // 强制设密码：除 /set-password 本身，所有受保护页面都拦截
    if (!location.pathname.startsWith("/set-password")) {
      try {
        const status = await getMyStatus();
        if (!status.hasPassword) {
          throw redirect({ to: "/set-password" });
        }
      } catch (e) {
        // 网络/接口错误不阻塞登录，让页面自己处理
        if (e && typeof e === "object" && "to" in e) throw e;
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
