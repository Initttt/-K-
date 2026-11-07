import type { Currency, ExtractedDevice } from "../types";

const textKeys = ["name", "brand", "model", "configuration", "purchaseDate", "purchaseDateText", "notes"] as const;
const keys = [...textKeys, "category", "purchasePrice"];
const nullableString = { type: ["string", "null"] };

export const deviceExtractionSchema = {
  type: "object",
  properties: {
    name: nullableString,
    category: { type: ["string", "null"], enum: ["phone", "tablet", "laptop", "gpu", null] },
    brand: nullableString,
    model: nullableString,
    configuration: nullableString,
    purchaseDate: nullableString,
    purchaseDateText: nullableString,
    purchasePrice: { type: ["number", "null"] },
    notes: nullableString,
  },
  required: keys,
  additionalProperties: false,
};

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateExtraction(value: unknown): ExtractedDevice {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_output");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== keys.length || keys.some((key) => !(key in data))) throw new Error("invalid_output");
  for (const key of textKeys) {
    if (data[key] !== null && (typeof data[key] !== "string" || (data[key] as string).length > 1000)) throw new Error("invalid_output");
  }
  if (data.category !== null && !["phone", "tablet", "laptop", "gpu"].includes(String(data.category))) throw new Error("invalid_output");
  if (data.purchasePrice !== null && (typeof data.purchasePrice !== "number" || !Number.isFinite(data.purchasePrice) || data.purchasePrice < 0 || data.purchasePrice > 1_000_000_000)) throw new Error("invalid_output");
  if (typeof data.purchaseDate === "string" && !isValidDate(data.purchaseDate)) throw new Error("invalid_output");
  return data as unknown as ExtractedDevice;
}

const normalize = (text: string) => text.toLowerCase().replace(/[\s,，]/g, "");

/** No exchange-rate inference: mixed, unknown, or different currencies need review. */
export function currencyWarning(text: string, target: Currency): string | null {
  const input = normalize(text);
  const currencies = new Set<Currency>();
  if (/jpy|eur|gbp|aud|cad|krw|twd|日元|日币|欧元|英镑|澳元|澳币|加元|韩元|台币|新台币|[€£円]/i.test(input)) return "输入包含当前不支持的币种，购入金额已留空；请按当前账户币种手动核对填写，不会自动换算。";
  if (/hkd|港币|港元|hk\$/i.test(input)) currencies.add("HKD");
  if (/usd|美元|美金|us\$/i.test(input)) currencies.add("USD");
  if (/cny|rmb|人民币|[￥¥]/i.test(input)) currencies.add("CNY");
  const remaining = input.replace(/hkd|港币|港元|hk\$|usd|美元|美金|us\$|cny|rmb|人民币/g, "");
  if (/元|块/.test(remaining)) currencies.add("CNY");
  if (currencies.size > 1) return "输入包含多种币种，购入金额已留空；请按当前账户币种核对填写，不会自动换算。";
  if (currencies.size === 0 && /\$/.test(remaining)) return "无法仅凭 $ 确认币种，购入金额已留空；请明确写出 USD 或 HKD，或手动填写。";
  if (currencies.size === 1 && !currencies.has(target)) return `输入金额的币种与当前账户 ${target} 不一致，购入金额已留空，不会自动换算。`;
  return null;
}

/** Conservative grounding: unsupported facts are left blank for the user to fill. */
export function groundExtraction(data: ExtractedDevice, text: string, currency: Currency = "CNY"): ExtractedDevice {
  const result = { ...data };
  const normalized = normalize(text);
  for (const key of ["name", "brand", "model", "configuration", "purchaseDateText", "notes"] as const) {
    const value = result[key];
    if (value !== null && (!value.trim() || !normalized.includes(normalize(value)))) result[key] = null;
  }
  if (result.purchaseDate) {
    const dates = Array.from(text.matchAll(/(\d{4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})(?:\s*日)?/g))
      .map((match) => `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`);
    if (!dates.includes(result.purchaseDate)) result.purchaseDate = null;
  }
  if (result.purchasePrice !== null) {
    // Keep only an explicitly written amount with a money unit or symbol.
    const amounts = Array.from(normalized.matchAll(/(?:[¥￥$]|人民币|港币|美元)?(\d+(?:\.\d+)?)\s*(万|千)?(?:元|块|人民币|港元|港币|美元|美金|cny|rmb|usd|hkd)/g))
      .map((match) => Number(match[1]) * (match[2] === "万" ? 10000 : match[2] === "千" ? 1000 : 1));
    for (const match of normalized.matchAll(/[¥￥$](\d+(?:\.\d+)?)/g)) amounts.push(Number(match[1]));
    if (!amounts.includes(result.purchasePrice)) result.purchasePrice = null;
  }
  if (currencyWarning(text, currency)) result.purchasePrice = null;
  return result;
}
