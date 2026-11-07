import { afterEach, describe, expect, it, vi } from "vitest";
import { AIError, createAIProvider } from "../src/lib/ai/provider.server";
import { currencyWarning, groundExtraction, validateExtraction } from "../src/lib/ai/schema";
import { GET, POST } from "../src/app/api/ai/extract/route";
import type { ExtractedDevice } from "../src/lib/types";

const blank: ExtractedDevice = {
  name: null, category: null, brand: null, model: null, configuration: null,
  purchaseDate: null, purchaseDateText: null, purchasePrice: null, notes: null,
};
const enabled = { AI_ENABLED: "true", OPENAI_API_KEY: "unit-test-not-a-real-key", OPENAI_MODEL: "unit-test-model" };
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
const completed = (device: unknown) => response({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(device) }] }] });
const request = (body: unknown, extra: Record<string, string> = {}) => new Request("http://localhost:3000/api/ai/extract", {
  method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json", ...extra }, body: JSON.stringify(body),
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("AI provider uses a real, optional server boundary", () => {
  it("does not call fetch without explicit enablement and complete configuration", async () => {
    const fetcher = vi.fn();
    for (const env of [{}, { ...enabled, AI_ENABLED: "false" }, { ...enabled, OPENAI_API_KEY: "" }, { ...enabled, OPENAI_MODEL: "" }]) {
      const provider = createAIProvider(env, fetcher);
      expect(provider.configured).toBe(false);
      await expect(provider.extract("手机")).rejects.toMatchObject({ status: 503 });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses documented Responses structured output and preserves partial dates", async () => {
    const text = "我在2026年5月花8000元买了一部手机，型号是测试X，容量256GB。";
    const fetcher = vi.fn().mockResolvedValue(completed({ ...blank, name: "手机", category: "phone", model: "测试X", configuration: "256GB", purchasePrice: 8000, purchaseDateText: "2026年5月" }));
    const extracted = await createAIProvider(enabled, fetcher).extract(text);
    expect(extracted.purchaseDate).toBeNull();
    expect(extracted.purchaseDateText).toBe("2026年5月");
    expect(extracted.purchasePrice).toBe(8000);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ model: "unit-test-model", store: false, text: { format: { type: "json_schema", strict: true, schema: { additionalProperties: false } } } });
    expect(body.text.format.schema.required).toHaveLength(9);
    expect(body.tools).toBeUndefined();
  });

  it("does not allow a model to invent brand, date, configuration or price", () => {
    const result = groundExtraction({ ...blank, brand: "虚构品牌", model: "测试X", purchaseDate: "2026-05-01", purchaseDateText: "2026年5月", configuration: "256GB", purchasePrice: 256 }, "2026年5月买了测试X，256GB");
    expect(result).toMatchObject({ brand: null, model: "测试X", purchaseDate: null, purchaseDateText: "2026年5月", configuration: "256GB", purchasePrice: null });
  });

  it("keeps explicitly supplied complete dates and amount units", () => {
    const result = groundExtraction({ ...blank, purchaseDate: "2026-05-12", purchasePrice: 8000 }, "2026年5月12日花0.8万元买的");
    expect(result.purchaseDate).toBe("2026-05-12");
    expect(result.purchasePrice).toBe(8000);
    expect(groundExtraction({ ...blank, purchasePrice: 0 }, "0元赠送").purchasePrice).toBe(0);
  });

  it("leaves mismatched, mixed and ambiguous currency amounts blank", () => {
    expect(groundExtraction({ ...blank, purchasePrice: 8000 }, "花8000元买的", "USD").purchasePrice).toBeNull();
    expect(groundExtraction({ ...blank, purchasePrice: 8000 }, "花8000港元买的", "HKD").purchasePrice).toBe(8000);
    expect(groundExtraction({ ...blank, purchasePrice: 8000 }, "花8000美元买的", "USD").purchasePrice).toBe(8000);
    expect(groundExtraction({ ...blank, purchasePrice: 8000 }, "花$8000买的", "USD").purchasePrice).toBeNull();
    expect(currencyWarning("花8000港币，相当于7000元", "CNY")).toContain("多种币种");
    expect(currencyWarning("花8000日元", "CNY")).toContain("不支持");
  });

  it.each([
    { ...blank, purchaseDate: "2026-02-30" },
    { ...blank, purchaseDate: "2026-05" },
    { ...blank, purchasePrice: -1 },
    { ...blank, purchasePrice: Infinity },
    { ...blank, category: "stock" },
    { name: "手机" },
    { ...blank, currentValue: 5000 },
  ])("rejects invalid schema or impossible financial/date fields", (data) => {
    expect(() => validateExtraction(data)).toThrow("invalid_output");
  });

  it("handles refusal and incomplete outputs", async () => {
    const refused = vi.fn().mockResolvedValue(response({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] }));
    await expect(createAIProvider(enabled, refused).extract("手机")).rejects.toMatchObject({ status: 422 });
    const incomplete = vi.fn().mockResolvedValue(response({ status: "incomplete", output: [] }));
    await expect(createAIProvider(enabled, incomplete).extract("手机")).rejects.toMatchObject({ status: 502 });
  });

  it("does not expose upstream errors or credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("secret upstream response", { status: 401 }));
    try { await createAIProvider(enabled, fetcher).extract("手机"); }
    catch (error) {
      expect(error).toBeInstanceOf(AIError);
      expect(String(error)).not.toContain("secret");
      expect(String(error)).not.toContain(enabled.OPENAI_API_KEY);
    }
    const rateLimited = vi.fn().mockResolvedValue(new Response("private", { status: 429 }));
    await expect(createAIProvider(enabled, rateLimited).extract("手机")).rejects.toMatchObject({ status: 429 });
  });

  it("aborts a stalled request after 20 seconds", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string | URL | Request, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const assertion = expect(createAIProvider(enabled, fetcher).extract("手机")).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });
});

describe("AI route", () => {
  function setEnv(active = false) {
    vi.stubEnv("AI_ENABLED", String(active));
    vi.stubEnv("OPENAI_API_KEY", active ? enabled.OPENAI_API_KEY : "");
    vi.stubEnv("OPENAI_MODEL", active ? enabled.OPENAI_MODEL : "");
  }

  it("provides explicit not-configured state without blocking manual entry", async () => {
    setEnv();
    expect(await GET().json()).toEqual({ configured: false });
    const result = await POST(request({ text: "手机" }));
    expect(result.status).toBe(503);
    expect((await result.json()).error).toContain("手动录入");
  });

  it("rejects cross-origin and non-JSON requests before any API call", async () => {
    setEnv(true);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await POST(request({ text: "手机" }, { origin: "https://attacker.invalid" }))).status).toBe(403);
    expect((await POST(request({ text: "手机" }, { "content-type": "text/plain" }))).status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("caps request and description size without contacting the provider", async () => {
    setEnv(true);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await POST(request({ text: "a".repeat(3001) }))).status).toBe(400);
    expect((await POST(request({ text: "a".repeat(17000) }))).status).toBe(413);
    expect((await POST(request({ text: "" }))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns only extracted fields for form review, without saving a device", async () => {
    setEnv(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completed({ ...blank, name: "手机", category: "phone" })));
    const result = await POST(request({ text: "手机" }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ device: { ...blank, name: "手机", category: "phone" } });
  });

  it("accepts the account currency and explains a mismatched amount", async () => {
    setEnv(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completed({ ...blank, name: "手机", category: "phone", purchasePrice: 8000 })));
    const result = await POST(request({ text: "8000元买的手机", currency: "USD" }));
    const data = await result.json();
    expect(result.status).toBe(200);
    expect(data.device.purchasePrice).toBeNull();
    expect(data.warning).toContain("USD");
    expect((await POST(request({ text: "手机", currency: "JPY" }))).status).toBe(400);
  });
});
