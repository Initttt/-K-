import type { Device, Valuation } from "./types";

const DAY_MS = 86_400_000;

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "1900-01-01") return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function midpoint(valuation: Valuation): number {
  return valuation.low + (valuation.high - valuation.low) / 2;
}

function usableValuation(device: Device, valuation: Valuation, asOf = todayISO()): boolean {
  return valuation.deviceId === device.id
    && valuation.currency === device.currency
    && valuation.region === device.region
    && (valuation.provider !== "demo" || device.demo === true)
    && isValidDate(valuation.dataDate)
    && valuation.dataDate >= device.purchaseDate
    && valuation.dataDate <= asOf
    && Number.isFinite(valuation.low)
    && Number.isFinite(valuation.high)
    && valuation.low >= 0
    && valuation.high >= valuation.low;
}

export function latestValuation(device: Device, valuations: Valuation[]): Valuation | undefined {
  return valuations.filter((valuation) => usableValuation(device, valuation))
    .sort((a, b) => b.dataDate.localeCompare(a.dataDate) || b.recordedAt.localeCompare(a.recordedAt))[0];
}

export function deviceMetrics(device: Device, valuation?: Valuation, asOf = todayISO()) {
  const validPurchase = isValidDate(device.purchaseDate) && isValidDate(asOf)
    && device.purchaseDate <= asOf && Number.isFinite(device.purchasePrice) && device.purchasePrice >= 0;
  const holdingDays = validPurchase
    ? Math.max(1, Math.floor((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${device.purchaseDate}T00:00:00Z`)) / DAY_MS))
    : 0;
  const validValuation = validPurchase && valuation && usableValuation(device, valuation, asOf);
  const value = validValuation ? midpoint(valuation) : null;
  const change = value === null ? null : value - device.purchasePrice;
  return {
    value,
    change,
    changeRate: change === null || device.purchasePrice === 0 ? null : change / device.purchasePrice,
    holdingDays,
    dailyCost: change === null || holdingDays === 0 ? null : -change / holdingDays,
  };
}

export function summary(devices: Device[], valuations: Valuation[]) {
  const markets = new Set(devices.map((device) => `${device.region}:${device.currency}`));
  if (markets.size > 1) throw new Error("不同地区或币种的设备不能合并统计，请切换到单一市场。");
  const purchaseTotal = devices.reduce((total, device) => total + device.purchasePrice, 0);
  let valuedCount = 0;
  let referenceTotal = 0;
  let valuedPurchaseTotal = 0;
  for (const device of devices) {
    const metrics = deviceMetrics(device, latestValuation(device, valuations));
    if (metrics.value !== null) {
      valuedCount++;
      referenceTotal += metrics.value;
      valuedPurchaseTotal += device.purchasePrice;
    }
  }
  const change = valuedCount ? referenceTotal - valuedPurchaseTotal : null;
  return {
    count: devices.length,
    purchaseTotal,
    valuedCount,
    referenceTotal: valuedCount ? referenceTotal : null,
    valuedPurchaseTotal,
    change,
    changeRate: change === null || valuedPurchaseTotal === 0 ? null : change / valuedPurchaseTotal,
  };
}

export function isStale(valuation: Valuation, asOf = todayISO()): boolean {
  if (!isValidDate(valuation.dataDate) || !isValidDate(asOf)) return true;
  return Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${valuation.dataDate}T00:00:00Z`) > 7 * DAY_MS;
}
