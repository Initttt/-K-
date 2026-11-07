import type { Device, Ledger, Valuation } from "./types";

const devices: Device[] = [
  { id: "demo-phone", name: "随身的创作伙伴", category: "phone", brand: "Apple", model: "iPhone 16 Pro", configuration: "256GB · 原色钛金属", purchaseDate: "2025-03-08", purchasePrice: 8999, condition: "轻微使用痕迹", battery: "92%", tags: "日常 / 摄影", notes: "所有价格及历史均为演示数据，非真实行情。", region: "CN", currency: "CNY", demo: true },
  { id: "demo-laptop", name: "我的移动工作站", category: "laptop", brand: "Apple", model: "MacBook Pro 14", configuration: "M4 Pro · 24GB / 512GB", purchaseDate: "2025-02-18", purchasePrice: 15999, condition: "外观良好", battery: "96%", tags: "工作", notes: "所有价格及历史均为演示数据，非真实行情。", region: "CN", currency: "CNY", demo: true },
  { id: "demo-tablet", name: "灵感随手记", category: "tablet", brand: "Apple", model: "iPad Air 11", configuration: "M3 · 128GB · Wi-Fi", purchaseDate: "2025-05-12", purchasePrice: 4799, condition: "接近全新", battery: "98%", tags: "阅读 / 手写", notes: "所有价格及历史均为演示数据，非真实行情。", region: "CN", currency: "CNY", demo: true },
  { id: "demo-gpu", name: "桌面性能核心", category: "gpu", brand: "NVIDIA", model: "GeForce RTX 4090", configuration: "24GB · 非公版", purchaseDate: "2025-01-22", purchasePrice: 12999, condition: "正常使用", tags: "创作 / 游戏", notes: "用固定模拟价格演示估值上升，不代表真实行情或已实现收益。", region: "CN", currency: "CNY", demo: true },
  { id: "demo-unknown", name: "备用小手机", category: "phone", brand: "Google", model: "Pixel 8a", configuration: "128GB", purchaseDate: "2026-06-16", purchasePrice: 2399, condition: "外观良好", tags: "备用", notes: "暂无模拟价格映射，可手动添加参考估值。", region: "CN", currency: "CNY", demo: true },
];

const histories: Record<string, [string, number, number][]> = {
  "demo-phone": [["2026-06-01", 6400, 6800], ["2026-07-01", 6200, 6600], ["2026-08-01", 6100, 6500], ["2026-09-01", 5900, 6300], ["2026-10-01", 5700, 6100], ["2026-11-01", 5600, 6000]],
  "demo-laptop": [["2026-06-01", 12400, 13200], ["2026-07-01", 12000, 12800], ["2026-08-01", 11900, 12700], ["2026-09-01", 11700, 12500], ["2026-10-01", 11500, 12300], ["2026-11-01", 11200, 12000]],
  "demo-tablet": [["2026-06-01", 3500, 3900], ["2026-07-01", 3400, 3800], ["2026-08-01", 3400, 3800], ["2026-09-01", 3300, 3700], ["2026-10-01", 3200, 3600], ["2026-11-01", 3100, 3500]],
  "demo-gpu": [["2026-06-01", 13300, 14300], ["2026-07-01", 13700, 14700], ["2026-08-01", 13400, 14400], ["2026-09-01", 14000, 15000], ["2026-10-01", 14200, 15200], ["2026-11-01", 14400, 15400]],
};

export function createDemoLedger(): Ledger {
  const valuations: Valuation[] = devices.flatMap((device) =>
    (histories[device.id] ?? []).map(([dataDate, low, high]) => ({
      id: `${device.id}-${dataDate}`,
      deviceId: device.id,
      low,
      high,
      dataDate,
      recordedAt: `${dataDate}T08:00:00.000Z`,
      source: "内置固定样例 · 演示数据，非真实行情",
      priceType: "simulated" as const,
      provider: "demo" as const,
      region: device.region,
      currency: device.currency,
    })),
  );
  return { version: 1, devices: devices.map((device) => ({ ...device })), valuations };
}
