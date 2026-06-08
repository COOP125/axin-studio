import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CourseTypeSchema = z.enum(["private", "student", "group", "cardio"]);

async function ensureCoachOrAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["coach", "admin"]);
  const roles = (data ?? []).map((r) => r.role);
  return { admin: supabaseAdmin, isAdmin: roles.includes("admin"), isCoach: roles.includes("coach") };
}

async function getAvatarSignedUrl(admin: Awaited<ReturnType<typeof getAdmin>>, path: string | null) {
  if (!path) return null;
  const { data } = await admin.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** 教练读取自己资料 */
export const getMyCoachProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, isCoach, isAdmin } = await ensureCoachOrAdmin(context.userId);
    if (!isCoach && !isAdmin) throw new Error("无教练权限");
    const { data, error } = await admin
      .from("profiles")
      .select("user_id, phone, nickname, display_name, bio, specialties, avatar_url")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      ...(data ?? null),
      avatar_signed_url: await getAvatarSignedUrl(admin, data?.avatar_url ?? null),
    };
  });

const UpdateProfileSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  bio: z.string().max(500).optional().nullable(),
  specialties: z.array(CourseTypeSchema).max(4),
});

/** 教练更新自己资料 */
export const updateMyCoachProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof UpdateProfileSchema>) => UpdateProfileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { admin, isCoach, isAdmin } = await ensureCoachOrAdmin(context.userId);
    if (!isCoach && !isAdmin) throw new Error("无教练权限");
    const { error } = await admin
      .from("profiles")
      .update({ nickname: data.nickname, bio: data.bio ?? null, specialties: data.specialties })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const UploadAvatarSchema = z.object({
  // dataURL: data:image/jpeg;base64,xxx
  dataUrl: z.string().regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, "仅支持 jpg/png/webp 图片"),
  target_user_id: z.string().uuid().optional(),
});

/** 上传头像。教练只能上传自己的，管理员可代为上传任意教练的。返回 signedUrl */
export const uploadCoachAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof UploadAvatarSchema>) => UploadAvatarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { admin, isAdmin } = await ensureCoachOrAdmin(context.userId);
    const targetId = data.target_user_id && isAdmin ? data.target_user_id : context.userId;

    const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("图片格式无效");
    const mime = match[1];
    const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
    const buf = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    if (buf.byteLength > 4 * 1024 * 1024) throw new Error("图片需小于 4MB");

    const path = `coaches/${targetId}.${ext}`;
    const { error: upErr } = await admin.storage.from("avatars").upload(path, buf, {
      contentType: mime,
      upsert: true,
    });
    if (upErr) throw new Error("上传失败：" + upErr.message);

    const { error: profErr } = await admin
      .from("profiles")
      .update({ avatar_url: path })
      .eq("user_id", targetId);
    if (profErr) throw new Error(profErr.message);

    const { data: signed } = await admin.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24);
    return { ok: true as const, path, signedUrl: signed?.signedUrl ?? null };
  });

/** 管理员读取某教练完整资料 */
export const adminGetCoachProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, isAdmin } = await ensureCoachOrAdmin(context.userId);
    if (!isAdmin) throw new Error("无管理员权限");
    const { data: p } = await admin
      .from("profiles")
      .select("user_id, phone, nickname, display_name, bio, specialties, avatar_url")
      .eq("user_id", data.user_id)
      .maybeSingle();
    return { ...(p ?? null), avatar_signed_url: await getAvatarSignedUrl(admin, p?.avatar_url ?? null) };
  });

const AdminUpdateSchema = UpdateProfileSchema.extend({ user_id: z.string().uuid() });

export const adminUpdateCoachProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof AdminUpdateSchema>) => AdminUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, isAdmin } = await ensureCoachOrAdmin(context.userId);
    if (!isAdmin) throw new Error("无管理员权限");
    const { error } = await admin
      .from("profiles")
      .update({ nickname: data.nickname, bio: data.bio ?? null, specialties: data.specialties })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
