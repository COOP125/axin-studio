// 客户端可用的手机号-合成邮箱映射
// 工作室会员/教练统一用手机号注册，Supabase Auth 内部仍以邮箱标识。
export const PHONE_EMAIL_DOMAIN = "phone.axinstudio.local";

export function phoneToEmail(phone: string): string {
  return `${phone}@${PHONE_EMAIL_DOMAIN}`;
}

export const CN_MOBILE_RE = /^1[3-9]\d{9}$/;
// 密码规则：长度 ≥6，必须同时包含字母和数字；特殊字符可选
export const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-={}[\]:;"'<>,.?/|\\~`]{6,64}$/;
export const PASSWORD_HINT = "至少 6 位，包含字母与数字（特殊字符可选）";
