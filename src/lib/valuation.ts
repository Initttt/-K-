import { isValidDate, todayISO } from "./calculations";
import { MAX_PRICE } from "./config";
import { createDemoLedger } from "./demo";
import type { Device, Valuation } from "./types";

export interface ValuationResult { valuation: Valuation | null; message: string }
export interface ValuationProvider {
  readonly id: string;
  refresh(device: Device, existing: Valuation[]): Promise<ValuationResult>;
}

export const manualProvider: ValuationProvider = {
  id: "manual",
  async refresh() {
    return { valuation: null, message: "手动参考价不会自动更新，请填写新的参考估值。原数据日期保持不变。" };
  },
};

export const demoProvider: ValuationProvider = {
  id: "demo",
  async refresh(device, existing) {
    if (!device.demo) return { valuation: null, message: "模拟行情仅用于演示空间，个人设备请手动填写参考估值。" };
    const demo = createDemoLedger();
    const original = demo.devices.find((item) => item.id === device.id
      && item.category === device.category && item.brand === device.brand
      && item.model === device.model && item.configuration === device.configuration
      && item.purchasePrice === device.purchasePrice && item.purchaseDate === device.purchaseDate
      && item.region === device.region && item.currency === device.currency);
    if (!original) return { valuation: null, message: "暂无此型号或配置的模拟估值，可手动填写参考估值。" };
    const valuation = demo.valuations.filter((item) => item.deviceId === device.id
      && item.dataDate >= device.purchaseDate && item.dataDate <= todayISO())
      .sort((a, b) => b.dataDate.localeCompare(a.dataDate))[0];
    if (!valuation) return { valuation: null, message: "暂无估值，可手动填写参考估值。" };
    const alreadyKnown = existing.some((item) => item.deviceId === device.id
      && item.region === device.region && item.currency === device.currency
      && (item.id === valuation.id || item.dataDate >= valuation.dataDate));
    if (alreadyKnown) return { valuation: null, message: "没有新的模拟数据，保留原快照和数据日期。演示行情固定，不随刷新随机变化。" };
    return { valuation: { ...valuation }, message: "已添加固定模拟快照。演示数据，非真实行情。" };
  },
};

export function validateManual(low: number, high: number, date: string, device: Device): string | null {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < 0 || low > MAX_PRICE || high > MAX_PRICE) return "参考估值必须是 0 到 10 亿元之间的有效金额。";
  if (high < low) return "区间上限不能低于下限。";
  if (!isValidDate(date)) return "请填写有效、完整的数据日期。";
  if (date > todayISO()) return "数据日期不能晚于今天。";
  if (date < device.purchaseDate) return "数据日期不能早于购买日期。";
  return null;
}
