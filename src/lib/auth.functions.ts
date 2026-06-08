import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PhoneSchema = z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的中国手机号");
const phoneToEmail = (phone: string) => `${phone}@phone.axinstudio.local`;

const RequestOtpSchema = z.object({ phone: PhoneSchema });

/**
 * Generate and store a 6-digit verification code for the phone.
 * DEV MODE: returns the code in the response so the UI can show it via toast.
 * In production, replace with a real SMS provider call (Aliyun/Tencent SMS) and
 * stop returning `devCode`.
 */
export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string }) => RequestOtpSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("phone_otp").insert({
      phone: data.phone,
      code,
      expires_at: expiresAt,
    });
    if (error) throw new Error("验证码生成失败：" + error.message);

    // TODO: replace with SMS provider in production
    return { ok: true as const, devCode: code };
  });

const VerifyOtpSchema = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^\d{6}$/, "验证码为 6 位数字"),
});

/**
 * Verify OTP, get-or-create the auth user, and return a magic-link token hash
 * the client uses to establish a session via `supabase.auth.verifyOtp`.
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; code: string }) => VerifyOtpSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up the most recent unconsumed OTP for this phone
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from("phone_otp")
      .select("*")
      .eq("phone", data.phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (fetchErr) throw new Error(fetchErr.message);
    const otp = rows?.[0];
    if (!otp) throw new Error("验证码不存在或已过期，请重新获取");

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      throw new Error("验证码已过期，请重新获取");
    }
    if (otp.attempts >= 5) throw new Error("尝试次数过多，请重新获取");

    if (otp.code !== data.code) {
      await supabaseAdmin.from("phone_otp").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
      throw new Error("验证码不正确");
    }

    await supabaseAdmin.from("phone_otp").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

    const email = phoneToEmail(data.phone);

    // Get-or-create user. Email confirmation auto-true.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { phone: data.phone, display_name: `会员-${data.phone.slice(-4)}` },
    });
    let userId = created?.user?.id;
    if (createErr && !/already.*registered|already exists/i.test(createErr.message)) {
      throw new Error("用户创建失败：" + createErr.message);
    }
    if (!userId) {
      // User exists — look up by email via listUsers filter
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u) => u.email === email);
      if (!found) throw new Error("用户查询失败");
      userId = found.id;
    }
    // Always ensure profile row exists (handles legacy users created before this logic)
    await supabaseAdmin
      .from("profiles")
      .upsert({ user_id: userId, phone: data.phone, display_name: `会员-${data.phone.slice(-4)}` }, { onConflict: "user_id" });

    // Generate a magic-link the client will exchange for a session
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      throw new Error("登录令牌生成失败：" + (linkErr?.message ?? "no token"));
    }

    return {
      tokenHash: linkData.properties.hashed_token,
      userId,
    };
  });

/**
 * One-time bootstrap: if no admin exists yet, promote the current signed-in
 * user to admin. After the first admin is created, this fails permanently.
 */
export const claimAdminIfUnclaimed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("教练账户已存在，无法重复初始化");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Fixed coach credentials. The username is mapped to a synthetic email so it
// can ride on Supabase's email/password auth without being a real address.
const COACH_USERNAME = "AXI-Studio";
const COACH_PASSWORD = "axi123456";
const COACH_EMAIL = "axi-studio@axinstudio.local";

const CoachSignInSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

/**
 * Validate fixed coach credentials, ensure the auth user + admin role exist,
 * and return the mapped email so the client can complete signInWithPassword.
 */
export const coachSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => CoachSignInSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.username !== COACH_USERNAME || data.password !== COACH_PASSWORD) {
      throw new Error("账号或密码不正确");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get-or-create the coach user with the fixed password.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: COACH_EMAIL,
      password: COACH_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "阿新教练", role: "coach" },
    });
    let userId = created?.user?.id;
    if (createErr && !/already.*registered|already exists/i.test(createErr.message)) {
      throw new Error("教练账户初始化失败：" + createErr.message);
    }
    if (!userId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u) => u.email === COACH_EMAIL);
      if (!found) throw new Error("教练账户查询失败");
      userId = found.id;
      // Force-reset password in case it drifted.
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: COACH_PASSWORD });
    }

    // Ensure admin role.
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    return { email: COACH_EMAIL, password: COACH_PASSWORD };
  });
