import { AIError, createAIProvider } from "../../../../lib/ai/provider.server";
import { currencyWarning } from "../../../../lib/ai/schema";
import type { Currency } from "../../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });

export function GET() {
  return json({ configured: createAIProvider().configured });
}

async function readLimitedBody(request: Request): Promise<string> {
  const limit = 16_000;
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > limit) throw new AIError(413, "描述内容过长。");
  if (!request.body) throw new AIError(400, "请输入设备描述。");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AIError(413, "描述内容过长。");
      }
      body += decoder.decode(part.value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return json({ error: "请求来源不匹配，请从本应用页面重试。" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "请求格式应为 JSON。" }, 415);
    const provider = createAIProvider();
    if (!provider.configured) return json({ error: "AI 尚未配置，请继续手动录入。" }, 503);
    let body: unknown;
    try { body = JSON.parse(await readLimitedBody(request)); }
    catch (error) {
      if (error instanceof AIError) throw error;
      return json({ error: "请求格式无效。" }, 400);
    }
    if (!body || typeof body !== "object" || !("text" in body) || typeof body.text !== "string" || !body.text.trim() || body.text.length > 3000) return json({ error: "请输入 1–3000 字的设备描述。" }, 400);
    const rawCurrency = "currency" in body ? body.currency : "CNY";
    if (typeof rawCurrency !== "string" || !["CNY", "USD", "HKD"].includes(rawCurrency)) return json({ error: "请选择受支持的账户币种。" }, 400);
    const currency = rawCurrency as Currency;
    const text = body.text.trim();
    const warning = currencyWarning(text, currency);
    return json({ device: await provider.extract(text, currency), ...(warning ? { warning } : {}) });
  } catch (error) {
    if (error instanceof AIError) return json({ error: error.message }, error.status);
    return json({ error: "AI 暂不可用，请继续手动录入。" }, 500);
  }
}
