import crypto from "crypto";

/**
 * Aliyun Dypnsapi (号码认证服务 - 短信认证) client.
 * 使用 RPC 风格 POP 签名 v1（HMAC-SHA1），无需 SDK 依赖。
 *
 * Docs:
 *  - SendSmsVerifyCode https://help.aliyun.com/document_detail/415253.html
 *  - 套餐包含平台提供的签名（如"速通互联验证码"）与模板（如 100001）
 *  - 需要 RAM 权限：AliyunDypnsFullAccess
 */

const ENDPOINT = "https://dypnsapi.aliyuncs.com/";
const VERSION = "2017-05-25";

function popEncode(input: string): string {
  return encodeURIComponent(input)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

interface AliyunCreds {
  accessKeyId: string;
  accessKeySecret: string;
}

function readCreds(): AliyunCreds {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("阿里云短信未配置：缺少 ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET");
  }
  return { accessKeyId, accessKeySecret };
}

async function callDypnsapi(action: string, params: Record<string, string>) {
  const { accessKeyId, accessKeySecret } = readCreds();

  const common: Record<string, string> = {
    Action: action,
    Format: "JSON",
    Version: VERSION,
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    ...params,
  };

  const sortedKeys = Object.keys(common).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${popEncode(k)}=${popEncode(common[k])}`)
    .join("&");

  const stringToSign = `GET&${popEncode("/")}&${popEncode(canonicalQuery)}`;
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  const url = `${ENDPOINT}?Signature=${popEncode(signature)}&${canonicalQuery}`;
  const res = await fetch(url, { method: "GET" });
  const body = (await res.json()) as Record<string, unknown>;

  if (!res.ok || (body.Code && body.Code !== "OK")) {
    const msg = (body.Message as string) || (body.Code as string) || `HTTP ${res.status}`;
    throw new Error(`阿里云短信失败：${msg}`);
  }
  return body;
}

interface SendSmsArgs {
  phoneNumber: string;
  verifyCode: string;
  signName: string;
  templateCode: string;
  outId: string;
  validTimeSeconds?: number;
}

export async function sendSmsVerifyCode(args: SendSmsArgs) {
  const validMinutes = Math.max(1, Math.ceil((args.validTimeSeconds ?? 300) / 60));
  const body = await callDypnsapi("SendSmsVerifyCode", {
    PhoneNumber: args.phoneNumber,
    SignName: args.signName,
    TemplateCode: args.templateCode,
    TemplateParam: JSON.stringify({ code: args.verifyCode, min: String(validMinutes) }),
    OutId: args.outId,
  });
  const model = (body.Model as Record<string, unknown> | undefined) ?? {};
  return { bizId: (model.BizId as string | undefined) ?? args.outId };
}

export function readSmsConfig() {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!signName || !templateCode) {
    throw new Error("阿里云短信未配置：缺少 ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE");
  }
  return { signName, templateCode };
}
