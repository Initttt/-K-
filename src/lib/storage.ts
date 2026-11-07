import { isValidDate, todayISO } from "./calculations";
import { CATEGORIES, MAX_PRICE } from "./config";
import type { Device, DeviceDraft, Ledger, Market, Valuation } from "./types";

export type LedgerMode = "personal" | "demo";
const CURRENCIES = new Set(["CNY", "USD", "HKD"]);
const PRICE_TYPES = new Set(["manual-reference", "simulated", "listing", "transaction", "buyback"]);
const PROVIDERS = new Set(["manual", "demo", "real"]);

export function storageKey(mode: LedgerMode, market: Market): string {
  return `my-gear:v1:${mode}:${market.region}:${market.currency}`;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validString(value: unknown, max = 500, required = false): value is string {
  return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
}

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_PRICE;
}

export function validateDevice(draft: DeviceDraft, market: Market): string | null {
  if (!draft.name.trim()) return "请填写设备名称。";
  if (draft.name.length > 100) return "设备名称最多 100 字。";
  if (!Object.hasOwn(CATEGORIES, draft.category)) return "请选择设备类别。";
  if (!draft.brand.trim() || !draft.model.trim()) return "请填写品牌和型号。";
  if (!draft.configuration.trim()) return "请填写配置；不确定时可以填写“待补充”。";
  if ([draft.brand, draft.model, draft.configuration, draft.condition, draft.battery, draft.tags].some((value) => value.length > 500) || draft.notes.length > 2000) return "部分字段过长，请缩短后保存。";
  if (!isValidDate(draft.purchaseDate)) return "请填写有效、完整的购买日期。";
  if (draft.purchaseDate > todayISO()) return "购买日期不能晚于今天。";
  if (draft.purchasePrice.trim() === "" || !validAmount(Number(draft.purchasePrice))) return "购买价格必须是 0 到 10 亿元之间的有效金额。";
  if (!CURRENCIES.has(market.currency) || !/^[A-Z]{2}$/.test(market.region)) return "地区或币种无效。";
  return null;
}

function parseLedger(value: unknown, market: Market, mode: LedgerMode): Ledger {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.devices) || !Array.isArray(value.valuations)) throw new Error("备份格式无效，需使用“我的装备”版本 1 的 JSON 备份。");
  if (value.devices.length > 10_000 || value.valuations.length > 100_000) throw new Error("备份过大，无法导入。");
  const ids = new Set<string>();
  const devices: Device[] = value.devices.map((item: unknown) => {
    if (!object(item) || !validString(item.id, 200, true) || ids.has(item.id)
      || !validString(item.name, 100, true) || !validString(item.category, 20) || !Object.hasOwn(CATEGORIES, item.category)
      || !validString(item.brand, 500, true) || !validString(item.model, 500, true)
      || !validString(item.configuration, 500, true)
      || !validString(item.purchaseDate, 10) || !isValidDate(item.purchaseDate) || item.purchaseDate > todayISO()
      || !validAmount(item.purchasePrice)) throw new Error("备份中的设备记录不完整或无效。");
    if (item.region !== market.region || item.currency !== market.currency) throw new Error("备份地区或币种与当前市场不符，请先切换市场。");
    if (mode === "demo" ? item.demo !== true : item.demo !== undefined && item.demo !== false) throw new Error("演示数据与个人数据不能混合导入。");
    for (const key of ["condition", "battery", "notes", "tags"]) {
      if (item[key] !== undefined && !validString(item[key], key === "notes" ? 2000 : 500)) throw new Error("备份中的可选字段无效。");
    }
    ids.add(item.id);
    return { ...item } as unknown as Device;
  });
  const valuationIds = new Set<string>();
  const valuations: Valuation[] = value.valuations.map((item: unknown) => {
    if (!object(item) || !validString(item.id, 200, true) || valuationIds.has(item.id)
      || !validString(item.deviceId, 200, true) || !ids.has(item.deviceId)
      || !validAmount(item.low) || !validAmount(item.high) || item.high < item.low
      || !validString(item.dataDate, 10) || !isValidDate(item.dataDate) || item.dataDate > todayISO()
      || !validString(item.recordedAt, 40) || !/^\d{4}-\d{2}-\d{2}T/.test(item.recordedAt) || !Number.isFinite(Date.parse(item.recordedAt))
      || !validString(item.source, 500, true) || typeof item.priceType !== "string" || !PRICE_TYPES.has(item.priceType)
      || typeof item.provider !== "string" || !PROVIDERS.has(item.provider)) throw new Error("备份中的估值快照不完整或无效。");
    // 保留类型扩展点，但基础版没有经过验证的真实行情获取及展示链路。
    if (item.provider === "real") throw new Error("当前版本尚未接入真实行情，无法导入未验证的真实来源估值。请使用手动参考估值。");
    if (item.currency !== market.currency || item.region !== market.region) throw new Error("估值快照地区或币种与当前市场不符。");
    if (mode === "personal" && (item.provider === "demo" || item.priceType === "simulated")) throw new Error("模拟行情不能导入个人空间。");
    if ((item.provider === "demo") !== (item.priceType === "simulated") || (item.provider === "manual") !== (item.priceType === "manual-reference")) throw new Error("估值来源与价格类型不一致。");
    valuationIds.add(item.id);
    return { ...item } as unknown as Valuation;
  });
  return { version: 1, devices, valuations };
}

export function parseBackup(text: string, market: Market, mode: LedgerMode): Ledger {
  if (text.length > 20_000_000) throw new Error("备份文件超过 20 MB，无法导入。");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("无法读取 JSON，请选择有效的备份文件。"); }
  return parseLedger(value, market, mode);
}

function contextFromKey(key: string): { mode: LedgerMode; market: Market } {
  const match = /^my-gear:v1:(personal|demo):([A-Z]{2}):(CNY|USD|HKD)$/.exec(key);
  if (!match) throw new Error("数据空间无效。");
  return { mode: match[1] as LedgerMode, market: { region: match[2], currency: match[3] as Market["currency"] } };
}

export function loadLedger(key: string): Ledger | null {
  const { mode, market } = contextFromKey(key);
  const text = window.localStorage.getItem(key);
  return text === null ? null : parseBackup(text, market, mode);
}

export function saveLedger(key: string, ledger: Ledger): void {
  const { mode, market } = contextFromKey(key);
  const checked = parseLedger(ledger, market, mode);
  const existing = window.localStorage.getItem(key);
  if (existing !== null) {
    try { parseBackup(existing, market, mode); }
    catch { throw new Error("现有本地数据损坏，已停止保存以保留原始记录。请先备份并检查浏览器中的原始数据。"); }
  }
  window.localStorage.setItem(key, JSON.stringify(checked));
}
