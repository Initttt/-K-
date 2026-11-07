import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deviceMetrics, isStale, isValidDate, latestValuation, midpoint, summary, todayISO } from "../src/lib/calculations";
import { DEFAULT_MARKET, MARKETS } from "../src/lib/config";
import { createDemoLedger } from "../src/lib/demo";
import { loadLedger, parseBackup, saveLedger, storageKey, validateDevice } from "../src/lib/storage";
import { demoProvider, manualProvider, validateManual } from "../src/lib/valuation";
import type { Device, DeviceDraft, Ledger, Valuation } from "../src/lib/types";

const device: Device = { id: "test", name: "测试手机", category: "phone", brand: "Example", model: "Phone 1", configuration: "256GB", purchaseDate: "2026-11-01", purchasePrice: 8000, region: "CN", currency: "CNY" };
const valuation: Valuation = { id: "v1", deviceId: device.id, low: 5600, high: 6000, dataDate: "2026-11-06", recordedAt: "2026-11-06T12:00:00.000Z", region: "CN", currency: "CNY", source: "用户手动填写", priceType: "manual-reference", provider: "manual" };
const draft: DeviceDraft = { ...device, purchasePrice: "8000", condition: "", battery: "", notes: "", tags: "" };
const ledger = (): Ledger => ({ version: 1, devices: [{ ...device }], valuations: [{ ...valuation }] });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 8, 12, 0, 0));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("估值计算", () => {
  it("区间取中值，并按同组设备计算汇总", () => {
    const missing = { ...device, id: "missing", purchasePrice: 2000 };
    expect(midpoint(valuation)).toBe(5800);
    expect(summary([device, missing], [valuation])).toEqual({ count: 2, purchaseTotal: 10000, valuedCount: 1, referenceTotal: 5800, valuedPurchaseTotal: 8000, change: -2200, changeRate: -0.275 });
  });
  it("缺少估值不按零元计，也不显示虚构损失", () => {
    expect(deviceMetrics(device)).toEqual({ value: null, change: null, changeRate: null, holdingDays: 7, dailyCost: null });
    expect(summary([device], []).referenceTotal).toBeNull();
    expect(summary([], []).change).toBeNull();
  });
  it("零买入价无变化率，有效零估值仍计入覆盖", () => {
    const zero = { ...device, purchasePrice: 0 };
    expect(deviceMetrics(zero, valuation).changeRate).toBeNull();
    expect(deviceMetrics(zero, valuation).change).toBe(5800);
    const zeroVal = { ...valuation, low: 0, high: 0 };
    expect(summary([zero], [zeroVal])).toMatchObject({ valuedCount: 1, referenceTotal: 0, change: 0, changeRate: null });
  });
  it("当天持有按一天；未来或非法日期不产生误导数字", () => {
    const sameDay = { ...device, purchaseDate: "2026-11-08" };
    const sameDayVal = { ...valuation, dataDate: "2026-11-08" };
    expect(deviceMetrics(sameDay, sameDayVal)).toMatchObject({ holdingDays: 1, dailyCost: 2200 });
    expect(deviceMetrics({ ...device, purchaseDate: "2026-11-09" }, valuation)).toMatchObject({ holdingDays: 0, value: null, dailyCost: null });
    expect(deviceMetrics({ ...device, purchaseDate: "invalid" }, valuation).change).toBeNull();
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2024-02-29")).toBe(true);
  });
  it("估值上升是正变化、负估算持有成本", () => {
    expect(deviceMetrics(device, { ...valuation, low: 9000, high: 10000 })).toMatchObject({ value: 9500, change: 1500, changeRate: 0.1875, dailyCost: -1500 / 7 });
  });
  it("不使用其他市场、未来、购买前或错设备的估值", () => {
    expect(latestValuation(device, [{ ...valuation, currency: "USD" }])).toBeUndefined();
    expect(latestValuation(device, [{ ...valuation, region: "HK" }])).toBeUndefined();
    expect(latestValuation(device, [{ ...valuation, dataDate: "2026-11-09" }])).toBeUndefined();
    expect(latestValuation(device, [{ ...valuation, dataDate: "2026-10-01" }])).toBeUndefined();
    expect(latestValuation(device, [{ ...valuation, deviceId: "other" }])).toBeUndefined();
    expect(() => summary([device, { ...device, id: "us", currency: "USD", region: "US" }], [])).toThrow("不同地区");
  });
  it("相同数据日期选择实际记录时间较新的快照", () => {
    const later = { ...valuation, id: "v2", high: 6200, recordedAt: "2026-11-06T13:00:00.000Z" };
    expect(latestValuation(device, [later, valuation])).toEqual(later);
  });
  it("超过七天才过期，恰好七天不过期", () => {
    expect(isStale({ ...valuation, dataDate: "2026-11-01" })).toBe(false);
    expect(isStale({ ...valuation, dataDate: "2026-10-31" })).toBe(true);
    expect(todayISO()).toBe("2026-11-08");
  });
});

describe("估值提供器", () => {
  it("演示数据稳定可复现且包含升值与缺失估值", () => {
    expect(createDemoLedger()).toEqual(createDemoLedger());
    const demo = createDemoLedger();
    expect(demo.devices).toHaveLength(5);
    expect(summary(demo.devices, demo.valuations).valuedCount).toBe(4);
    expect(demo.valuations.every((item) => item.source.includes("演示数据，非真实行情") && item.provider === "demo")).toBe(true);
    expect(demo.devices.some((item) => (deviceMetrics(item, latestValuation(item, demo.valuations)).change ?? 0) > 0)).toBe(true);
  });
  it("无新模拟数据时不新增快照，不更改日期或价格", async () => {
    const demo = createDemoLedger();
    const before = JSON.stringify(demo);
    expect((await demoProvider.refresh(demo.devices[0], demo.valuations)).valuation).toBeNull();
    expect(JSON.stringify(demo)).toBe(before);
    const first = await demoProvider.refresh(demo.devices[0], []);
    const second = await demoProvider.refresh(demo.devices[0], []);
    expect(first.valuation).toEqual(second.valuation);
    expect(first.valuation?.dataDate).toBe("2026-11-01");
  });
  it("个人、未知或已改型号的设备不得到模拟价格", async () => {
    const demo = createDemoLedger();
    for (const item of [{ ...demo.devices[0], demo: false }, { ...demo.devices[0], model: "其他型号" }, { ...demo.devices[0], purchasePrice: 1 }, demo.devices[4]]) {
      expect((await demoProvider.refresh(item, [])).valuation).toBeNull();
    }
    expect((await manualProvider.refresh(device, [valuation])).valuation).toBeNull();
  });
  it("手动估值拒绝坏区间、NaN、未来和购买前日期", () => {
    expect(validateManual(100, 90, "2026-11-06", device)).toContain("上限");
    expect(validateManual(NaN, 200, "2026-11-06", device)).not.toBeNull();
    expect(validateManual(-1, 200, "2026-11-06", device)).not.toBeNull();
    expect(validateManual(100, 200, "2026-11-09", device)).toContain("晚于");
    expect(validateManual(100, 200, "2026-10-31", device)).toContain("早于");
    expect(validateManual(0, 0, "2026-11-08", device)).toBeNull();
  });
});

describe("本地保存与备份", () => {
  it("每个模式和市场分别存储，刷新读取保留内容", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } });
    const personalKey = storageKey("personal", DEFAULT_MARKET);
    const demoKey = storageKey("demo", DEFAULT_MARKET);
    expect(personalKey).not.toBe(demoKey);
    expect(personalKey).not.toBe(storageKey("personal", MARKETS[1]));
    expect(loadLedger(personalKey)).toBeNull();
    saveLedger(personalKey, ledger());
    saveLedger(demoKey, createDemoLedger());
    expect(loadLedger(personalKey)).toEqual(ledger());
    expect(loadLedger(demoKey)?.devices).toHaveLength(5);
    const changed = { ...ledger(), devices: [{ ...device, name: "新名称" }] };
    saveLedger(personalKey, changed);
    expect(loadLedger(personalKey)?.devices[0].name).toBe("新名称");
    saveLedger(personalKey, { version: 1, devices: [], valuations: [] });
    expect(loadLedger(personalKey)?.devices).toHaveLength(0);
    expect(loadLedger(demoKey)?.devices).toHaveLength(5);
  });
  it("损坏存储抛错且不覆盖原始内容", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { getItem: () => "bad-json", setItem } });
    expect(() => loadLedger(storageKey("personal", DEFAULT_MARKET))).toThrow("JSON");
    expect(() => saveLedger(storageKey("personal", DEFAULT_MARKET), ledger())).toThrow("停止保存");
    expect(setItem).not.toHaveBeenCalled();
  });
  it("有效 JSON 但字段损坏的本地数据同样不会被覆盖", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify({ ...ledger(), devices: [{ ...device, purchasePrice: -1 }] }), setItem } });
    expect(() => loadLedger(storageKey("personal", DEFAULT_MARKET))).toThrow("设备记录");
    expect(() => saveLedger(storageKey("personal", DEFAULT_MARKET), ledger())).toThrow("原始记录");
    expect(setItem).not.toHaveBeenCalled();
  });
  it("存储权限或容量错误会传出，不报告虚假的保存成功", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } } });
    expect(() => saveLedger(storageKey("personal", DEFAULT_MARKET), ledger())).toThrow("QuotaExceededError");
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("SecurityError"); } } });
    expect(() => loadLedger(storageKey("personal", DEFAULT_MARKET))).toThrow("SecurityError");
  });
  it("导入校验模式、市场、字段、日期与估值关联", () => {
    expect(parseBackup(JSON.stringify(ledger()), DEFAULT_MARKET, "personal")).toEqual(ledger());
    expect(() => parseBackup(JSON.stringify(createDemoLedger()), DEFAULT_MARKET, "personal")).toThrow("演示");
    expect(() => parseBackup(JSON.stringify(ledger()), MARKETS[1], "personal")).toThrow("市场");
    expect(() => parseBackup("[]", DEFAULT_MARKET, "personal")).toThrow("格式");
    for (const corrupt of [
      { ...ledger(), devices: [{ ...device, purchasePrice: -1 }] },
      { ...ledger(), devices: [{ ...device, purchaseDate: "2026-02-31" }] },
      { ...ledger(), devices: [{ ...device, purchaseDate: "2026-11-09" }] },
      { ...ledger(), devices: [device, device] },
      { ...ledger(), valuations: [{ ...valuation, deviceId: "orphan" }] },
      { ...ledger(), valuations: [{ ...valuation, high: 100 }] },
      { ...ledger(), valuations: [{ ...valuation, provider: "demo", priceType: "simulated" }] },
    ]) expect(() => parseBackup(JSON.stringify(corrupt), DEFAULT_MARKET, "personal")).toThrow();
  });
  it("必要字段和金额需要校验，零金额合法", () => {
    expect(validateDevice(draft, DEFAULT_MARKET)).toBeNull();
    expect(validateDevice({ ...draft, purchasePrice: "0" }, DEFAULT_MARKET)).toBeNull();
    for (const bad of [{ name: "" }, { category: "" as const }, { brand: "" }, { model: "" }, { configuration: "" }, { purchaseDate: "2026-11-09" }, { purchasePrice: "" }, { purchasePrice: "Infinity" }, { purchasePrice: "-1" }]) {
      expect(validateDevice({ ...draft, ...bad }, DEFAULT_MARKET)).not.toBeNull();
    }
  });
  it("基础版明确拒绝导入未经验证的真实行情来源", () => {
    for (const priceType of ["listing", "transaction", "buyback"] as const) {
      expect(() => parseBackup(JSON.stringify({ ...ledger(), valuations: [{ ...valuation, provider: "real", priceType }] }), DEFAULT_MARKET, "personal")).toThrow("尚未接入真实行情");
    }
    const demo = createDemoLedger();
    demo.valuations[0] = { ...demo.valuations[0], provider: "real", priceType: "listing" };
    expect(() => parseBackup(JSON.stringify(demo), DEFAULT_MARKET, "demo")).toThrow("尚未接入真实行情");
  });
});
