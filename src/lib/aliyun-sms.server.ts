import crypto from "crypto";

/**
 * Aliyun Dypnsapi (短信认证服务 / 号码认证 PNVS) client.
 * Uses RPC-style POP signature v1 (HMAC-SHA1), so no SDK dependency is needed
 * and it runs inside the Cloudflare Worker SSR runtime.
 *
 * Docs:
 *  - SendSmsVerifyCode  https://help.aliyun.com/zh/pnvs/developer-reference/api-dypnsapi-2017-05-25-sendsmsverifycode
 *  - CheckSmsVerifyCode https://help.aliyun.com/zh/pnvs/developer-reference/api-dypnsapi-2017-05-25-checksmsverifycode
 */

const ENDPOINT = "https://dypnsapi.aliyuncs.com/";
const VERSION = "2017-05-25";

// RFC3986 percent-encoding as required by Aliyun POP.
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
  signName: string;
  templateCode: string;
  outId: string;
  validTimeSeconds?: number;
}

export async function sendSmsVerifyCode(args: SendSmsArgs) {
  const body = await callDypnsapi("SendSmsVerifyCode", {
    PhoneNumber: args.phoneNumber,
    SignName: args.signName,
    TemplateCode: args.templateCode,
    OutId: args.outId,
    ValidTime: String(args.validTimeSeconds ?? 300),
    CodeType: "1",
  });
  const model = body.Model as { OutId?: string; RequestId?: string } | undefined;
  return { outId: model?.OutId ?? args.outId };
}

interface CheckSmsArgs {
  phoneNumber: string;
  verifyCode: string;
  outId: string;
}

export async function checkSmsVerifyCode(args: CheckSmsArgs): Promise<boolean> {
  const body = await callDypnsapi("CheckSmsVerifyCode", {
    PhoneNumber: args.phoneNumber,
    VerifyCode: args.verifyCode,
    OutId: args.outId,
    CountryCode: "86",
    CaseAuthPolicy: "0",
  });
  const model = body.Model as { VerifyResult?: string } | undefined;
  // VerifyResult: "PASS" on success, "NONEXISTENT"/"UN_MATCH" otherwise.
  return model?.VerifyResult === "PASS";
}

export function readSmsConfig() {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!signName || !templateCode) {
    throw new Error("阿里云短信未配置：缺少 ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE");
  }
  return { signName, templateCode };
}
