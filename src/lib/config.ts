import type { Category, Market } from "./types";

export const LOCALE = "zh-CN";
export const CATEGORIES: Record<Category, string> = {
  phone: "手机",
  tablet: "平板",
  laptop: "笔记本电脑",
  gpu: "显卡",
};

// 每个市场使用独立账本；切换币种不会换算或重新标记旧数据。
export const MARKETS: (Market & { id: string; label: string })[] = [
  { id: "cn-cny", label: "中国大陆 · 人民币", region: "CN", currency: "CNY" },
  { id: "hk-hkd", label: "中国香港 · 港币", region: "HK", currency: "HKD" },
  { id: "us-usd", label: "美国 · 美元", region: "US", currency: "USD" },
];
export const DEFAULT_MARKET = MARKETS[0];
export const MAX_PRICE = 1_000_000_000;
