import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PASSWORD_RE } from "@/lib/phone";

/**
 * 返回当前登录用户的关键状态：是否已设密码 + 角色列表 + 手机号
 * 用于强制设密码路由网关和首页跳转。
 */
export const getMyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profileRes, rolesRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("has_password, phone, display_name, nickname")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    return {
      hasPassword: profileRes.data?.has_password ?? false,
      phone: profileRes.data?.phone ?? null,
      displayName: profileRes.data?.nickname ?? profileRes.data?.display_name ?? null,
      roles: (rolesRes.data ?? []).map((r) => r.role as "member" | "coach" | "admin"),
    };
  });

const SetPasswordSchema = z.object({
  password: z.string().regex(PASSWORD_RE, "密码至少 6 位，包含字母与数字"),
});

/**
 * 为当前登录用户设置密码，并把 profiles.has_password 标记为 true。
 * 使用 supabaseAdmin 调用 auth.admin.updateUserById，避免客户端 updateUser 在某些边缘场景下的会话刷新问题。
 */
export const setMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { password: string }) => SetPasswordSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });
    if (pwErr) throw new Error("密码设置失败：" + pwErr.message);
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ has_password: true })
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });
