"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import type { Category, Device, DeviceDraft, ExtractedDevice, Market } from "@/lib/types";
import { CATEGORIES } from "@/lib/config";
import { todayISO } from "@/lib/calculations";
import { validateDevice } from "@/lib/storage";
import { createId } from "@/lib/id";

export function DeviceForm({ device, market, demo, startAI = false, onSave, onCancel }: { device?: Device; market: Market; demo: boolean; startAI?: boolean; onSave: (device: Device) => boolean; onCancel: () => void }) {
  const [draft, setDraft] = useState<DeviceDraft>({ name: device?.name ?? "", category: device?.category ?? "", brand: device?.brand ?? "", model: device?.model ?? "", configuration: device?.configuration ?? "", purchaseDate: device?.purchaseDate ?? "", purchasePrice: device ? String(device.purchasePrice) : "", condition: device?.condition ?? "", battery: device?.battery ?? "", notes: device?.notes ?? "", tags: device?.tags ?? "" });
  const [tab, setTab] = useState(startAI ? "ai" : "manual");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [aiStatusError, setAIStatusError] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/ai/extract").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (active) setConfigured(data.configured === true); }).catch(() => { if (active) { setConfigured(false); setAIStatusError(true); } });
    return () => { active = false; };
  }, []);
  const field = (key: keyof DeviceDraft, value: string) => setDraft(d => ({ ...d, [key]: value }));
  async function extract() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/ai/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, currency: market.currency }), signal: AbortSignal.timeout(35000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "识别失败，请稍后重试或手动填写。");
      const extracted = data.device as ExtractedDevice;
      // Replace rather than merge: absent information must remain blank for review.
      setDraft({ name: extracted.name ?? "", category: extracted.category ?? "", brand: extracted.brand ?? "", model: extracted.model ?? "", configuration: extracted.configuration ?? "", purchaseDate: extracted.purchaseDate ?? "", purchasePrice: extracted.purchasePrice === null ? "" : String(extracted.purchasePrice), condition: "", battery: "", notes: extracted.notes ?? "", tags: "" });
      setNotice(`已填入你明确提供的信息，请逐项检查后保存。${extracted.purchaseDateText && !extracted.purchaseDate ? `购买时间为“${extracted.purchaseDateText}”，请补充具体日期。` : ""}${data.warning || ""}金额不做汇率转换，请按当前账户币种核对。`);
      setTab("manual");
    } catch (e) { setError(e instanceof Error ? e.message : "识别失败，可继续手动填写。"); }
    finally { setBusy(false); }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const validation = validateDevice(draft, market);
    if (validation) { setError(validation); return; }
    setError("");
    onSave({ ...market, ...draft, id: device?.id ?? createId(), category: draft.category as Category, purchasePrice: Number(draft.purchasePrice), name: draft.name.trim(), brand: draft.brand.trim(), model: draft.model.trim(), configuration: draft.configuration.trim(), battery: draft.category === "gpu" ? "" : draft.battery, demo });
  }
  return <form onSubmit={submit} noValidate>
    {!device && <div className="form-tabs"><button type="button" className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>手动填写</button><button type="button" className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}><Sparkles size={15} />一句话录入</button></div>}
    <div className="dialog-content">
      {tab === "ai" && <section className="ai-panel">
        <div className="section-heading"><Sparkles size={19} /><h3>把购入经历，变成设备记录</h3></div>
        <p>只提取你写出的信息。AI 不提供市场估值，保存前仍需你确认。</p>
        <label htmlFor="ai-text">描述你的设备</label><textarea id="ai-text" value={text} onChange={e => setText(e.target.value)} maxLength={3000} rows={4} placeholder="我在2026年5月花8000元买了一部手机，型号是……，容量256GB。" />
        <div className="ai-status">{configured === null ? "正在检查 AI 配置…" : configured ? "已配置 · 点击提取将把这段文字发送至配置的 OpenAI 服务。" : aiStatusError ? "暂时无法检查 AI 服务，可继续手动录入。" : "AI 尚未配置 · 你仍然可以完整使用手动录入功能。"}</div>
        <button type="button" className="button primary" disabled={!configured || !text.trim() || busy} onClick={extract}>{busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{busy ? "正在提取…" : "提取并填写表单"}</button>
        {!configured && <button type="button" className="text-button" onClick={() => setTab("manual")}>继续手动填写 <ArrowRight size={15} /></button>}
      </section>}
      {notice && <div className="notice success" role="status">{notice}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {tab === "manual" && <>
        <div className="form-grid">
          <label className="full">设备名称 <span>*</span><input autoComplete="off" maxLength={80} value={draft.name} onChange={e => field("name", e.target.value)} placeholder="例如：我的随身手机" required /></label>
          <label>设备类别 <span>*</span><select value={draft.category} onChange={e => field("category", e.target.value)} required><option value="">请选择类别</option>{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>品牌 <span>*</span><input maxLength={60} value={draft.brand} onChange={e => field("brand", e.target.value)} placeholder="例如：Apple" required /></label>
          <label>型号 <span>*</span><input maxLength={100} value={draft.model} onChange={e => field("model", e.target.value)} placeholder="例如：iPhone 16 Pro" required /></label>
          <label>配置 <span>*</span><input maxLength={200} value={draft.configuration} onChange={e => field("configuration", e.target.value)} placeholder={draft.category === "gpu" ? "例如：24GB 显存" : "例如：256GB / 原色"} required /></label>
          <label>购买日期 <span>*</span><input type="date" max={todayISO()} value={draft.purchaseDate} onChange={e => field("purchaseDate", e.target.value)} required /></label>
          <label>购买价格（{market.currency}）<span>*</span><input type="number" min="0" max="100000000" step="0.01" inputMode="decimal" value={draft.purchasePrice} onChange={e => field("purchasePrice", e.target.value)} placeholder="0.00" required /></label>
          <label>成色 <small>可选</small><select value={draft.condition} onChange={e => field("condition", e.target.value)}><option value="">暂不填写</option>{draft.condition && !["近乎全新", "轻微使用痕迹", "明显使用痕迹", "需要维修"].includes(draft.condition) && <option>{draft.condition}</option>}<option>近乎全新</option><option>轻微使用痕迹</option><option>明显使用痕迹</option><option>需要维修</option></select></label>
          {draft.category !== "gpu" && <label>电池状态 <small>可选</small><input maxLength={80} value={draft.battery} onChange={e => field("battery", e.target.value)} placeholder="例如：健康度 92%" /></label>}
          <label className="full">标签 <small>可选</small><input maxLength={120} value={draft.tags} onChange={e => field("tags", e.target.value)} placeholder="例如：日常主力、创作、备用" /></label>
          <label className="full">备注 <small>可选</small><textarea rows={2} maxLength={1000} value={draft.notes} onChange={e => field("notes", e.target.value)} placeholder="记录一些关于它的小事…" /></label>
        </div>
        <p className="muted tiny">{demo ? "此设备只会保存在演示空间。" : "保存在此浏览器的个人空间，不会与演示设备混合。"}新设备不会自动获得市场估值。</p>
      </>}
    </div>
    <footer className="dialog-footer"><button type="button" className="button secondary" onClick={onCancel}>取消</button>{tab === "manual" && <button type="submit" className="button primary">{device ? "保存修改" : "确认并添加设备"}</button>}</footer>
  </form>;
}
