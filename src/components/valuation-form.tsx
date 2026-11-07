"use client";
import { useState, type FormEvent } from "react";
import type { Device, Valuation } from "@/lib/types";
import { todayISO } from "@/lib/calculations";
import { validateManual } from "@/lib/valuation";
import { createId } from "@/lib/id";

export function ValuationForm({ device, onSave, onCancel }: { device: Device; onSave: (valuation: Valuation) => void; onCancel: () => void }) {
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!low.trim() || !source.trim()) { setError("请填写参考金额和来源说明。"); return; }
    const bottom = Number(low), top = high.trim() ? Number(high) : bottom;
    const validation = validateManual(bottom, top, date, device);
    if (validation) { setError(validation); return; }
    onSave({ id: createId(), deviceId: device.id, low: bottom, high: top, dataDate: date, recordedAt: new Date().toISOString(), source: source.trim(), provider: "manual", priceType: "manual-reference", region: device.region, currency: device.currency });
  }
  return <form onSubmit={submit} noValidate><div className="dialog-content">
    <div className="notice">你填写的参考值会标为“手动参考估值”，不视为已经验证的市场成交价。请使用 {device.region} 市场的 {device.currency} 金额。</div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="form-grid">
      <label>参考值 / 区间下限 <span>*</span><input type="number" min="0" step="0.01" value={low} onChange={e => setLow(e.target.value)} placeholder="例如：5000" /></label>
      <label>区间上限 <small>可选</small><input type="number" min="0" step="0.01" value={high} onChange={e => setHigh(e.target.value)} placeholder="留空表示单一参考值" /></label>
      <label className="full">数据日期 <span>*</span><input type="date" min={device.purchaseDate} max={todayISO()} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="full">来源说明 <span>*</span><input maxLength={200} value={source} onChange={e => setSource(e.target.value)} placeholder="例如：自己的预估 / 某店回收报价截图" /></label>
    </div><p className="muted tiny">有区间时以中值计算。每次保存会新增快照，历史不会被覆盖。</p>
  </div><footer className="dialog-footer"><button type="button" className="button secondary" onClick={onCancel}>取消</button><button className="button primary" type="submit">保存参考估值</button></footer></form>;
}
