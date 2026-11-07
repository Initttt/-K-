import type { Metadata } from "next";
import "./globals.css";
import { LOCALE } from "@/lib/config";

export const metadata: Metadata = {
  title: "我的装备 · 个人电子设备账户",
  description: "记录陪伴你的电子设备，了解参考价值与估算持有成本。单用户本地模式。",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang={LOCALE}><body>{children}</body></html>;
}
