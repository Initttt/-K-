"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Box, Check, ChevronRight, CircleHelp, Cpu, Download, HardDrive, LayoutGrid, Laptop, LoaderCircle, Monitor, Plus, RefreshCw, Search, Settings2, ShieldCheck, Smartphone, Sparkles, Tablet, Trash2, Upload, Wallet, X } from "lucide-react";
import type { Category, Device, Ledger, Market } from "@/lib/types";
import { CATEGORIES, DEFAULT_MARKET, LOCALE, MARKETS } from "@/lib/config";
import { deviceMetrics, isStale, latestValuation, midpoint, summary } from "@/lib/calculations";
import { createDemoLedger } from "@/lib/demo";
import { loadLedger, parseBackup, saveLedger, storageKey } from "@/lib/storage";
import { demoProvider, manualProvider } from "@/lib/valuation";
import { Dialog } from "./dialog";
import { DeviceForm } from "./device-form";
import { ValuationForm } from "./valuation-form";
import { HistoryChart } from "./history-chart";

const EMPTY: Ledger = { version: 1, devices: [], valuations: [] };
const PREFERENCE_KEY = "my-gear:preferences:v1";
const ICONS = { phone: Smartphone, tablet: Tablet, laptop: Laptop, gpu: Cpu };
const PRICE_TYPES = { "manual-reference": "手动参考估值", simulated: "模拟参考价", listing: "挂牌价", transaction: "成交价", buyback: "回收报价" };
function DeviceIcon({ category, large = false }: { category: Category; large?: boolean }) { const Icon = ICONS[category]; return <span className={`device-icon device-${category} ${large ? "large" : ""}`}><Icon size={large ? 40 : 27} strokeWidth={1.5} /></span>; }
function downloadFile(text: string, filename: string) { const blob = new Blob([text], { type: "application/json;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export default function GearApp() {
  const [mode, setMode] = useState<"personal" | "demo">("personal");
  const [marketId, setMarketId] = useState(DEFAULT_MARKET.id);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [ledger, setLedger] = useState<Ledger>(EMPTY);
  const [loadedKey, setLoadedKey] = useState("");
  const [loadError, setLoadError] = useState("");
  const [nav, setNav] = useState("overview");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [form, setForm] = useState<{ device?: Device; ai?: boolean } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [valuationDevice, setValuationDevice] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState<Device | null>(null);
  const [settings, setSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importError, setImportError] = useState("");
  const [pendingImport, setPendingImport] = useState<Ledger | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeMarket = MARKETS.find(m => m.id === marketId) ?? DEFAULT_MARKET;
  const market: Market = mode === "demo" ? DEFAULT_MARKET : activeMarket;
  const key = storageKey(mode, market);
  const ready = preferencesLoaded && loadedKey === key;
  const selected = ledger.devices.find(d => d.id === selectedId);
  const totals = summary(ledger.devices, ledger.valuations);
  const money = (value: number | null | undefined, decimals?: number) => value == null ? "—" : new Intl.NumberFormat(LOCALE, { style: "currency", currency: market.currency, minimumFractionDigits: decimals ?? (Number.isInteger(value) ? 0 : 2), maximumFractionDigits: decimals ?? 2 }).format(value);
  const signed = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`;
  const percent = (value: number | null) => value === null ? "不适用" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

  /* Browser storage is unavailable during server rendering. Hydrate each ledger
     after mount and on an explicit space/market change, guarded by loadedKey. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const preference = JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? "null");
      if (preference && MARKETS.some(item => item.id === preference.marketId)) setMarketId(preference.marketId);
      if (preference?.mode === "demo" || preference?.mode === "personal") setMode(preference.mode);
    } catch { /* A missing preference never replaces or resets ledger data. */ }
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    try {
      let data = loadLedger(key);
      if (!data) { data = mode === "demo" ? createDemoLedger() : { version: 1, devices: [], valuations: [] }; if (mode === "demo") saveLedger(key, data); }
      setLedger(data); setLoadError("");
    } catch (e) { setLedger(EMPTY); setLoadError(e instanceof Error ? e.message : "无法读取本地记录。"); }
    setLoadedKey(key);
  }, [key, mode]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      try { setLedger(loadLedger(key) ?? EMPTY); setLoadError(""); setToast({ message: "已同步此浏览器其他标签页的修改。" }); }
      catch { setLoadError("其他标签页的记录无法读取，请先导出原始备份。"); }
    };
    window.addEventListener("storage", onStorage); return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  function commit(next: Ledger) {
    if (!ready || loadError) { setToast({ message: "当前记录尚未成功读取，已阻止覆盖。请先备份并检查。", error: true }); return false; }
    try { saveLedger(key, next); setLedger(next); return true; }
    catch (e) { setToast({ message: e instanceof Error ? e.message : "保存失败，请导出备份。", error: true }); return false; }
  }
  function savePreference(nextMode: "personal" | "demo", nextMarketId: string) {
    try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ mode: nextMode, marketId: nextMarketId })); }
    catch { setToast({ message: "浏览器未能记住空间偏好，请检查存储权限。设备记录未被更改。", error: true }); }
  }
  function changeMode(next: "personal" | "demo") {
    if (next === mode) return;
    savePreference(next, marketId); setMode(next); setCategory("all"); setSearch(""); setSelectedId(null);
  }
  function saveDevice(device: Device) {
    const old = ledger.devices.find(d => d.id === device.id);
    const changedIdentity = old && ["brand", "model", "configuration", "category"].some(k => old[k as keyof Device] !== device[k as keyof Device]);
    if (changedIdentity && ledger.valuations.some(v => v.deviceId === device.id) && !window.confirm("品牌、型号、类别或配置已改变。为避免将旧设备估值用于新配置，保存会清除该设备的旧估值记录。确认保存吗？")) return false;
    const next = { ...ledger, devices: old ? ledger.devices.map(d => d.id === device.id ? device : d) : [...ledger.devices, device], valuations: changedIdentity ? ledger.valuations.filter(v => v.deviceId !== device.id) : ledger.valuations };
    if (!commit(next)) return false;
    setForm(null); setToast({ message: old ? "设备信息已保存。" : "设备已加入你的装备账户。" }); return true;
  }
  async function refresh(device?: Device) {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const targets = device ? [device] : ledger.devices;
      const results = await Promise.all(targets.map(d => (d.demo ? demoProvider : manualProvider).refresh(d, ledger.valuations)));
      const additions = results.flatMap(r => r.valuation ? [r.valuation] : []);
      if (additions.length && !commit({ ...ledger, valuations: [...ledger.valuations, ...additions] })) return;
      setToast({ message: additions.length ? `已保存 ${additions.length} 条新估值快照。` : device ? results[0].message : mode === "demo" ? "演示快照已是最新。没有新数据，原数据日期保持不变。" : "当前为手动估值模式，没有可自动获取的新行情。请在设备详情填写参考估值。" });
    } catch { setToast({ message: "刷新未成功，已保留原估值与数据日期。", error: true }); }
    finally { setRefreshing(false); }
  }
  function exportBackup() { downloadFile(JSON.stringify(ledger, null, 2), `我的装备-${mode}-${market.region}-${market.currency}.json`); setToast({ message: "JSON 备份已导出，请保存在安全的位置。" }); }
  async function readBackup(file?: File) {
    if (!file) return;
    setImportError(""); setPendingImport(null);
    try { if (file.size > 5 * 1024 * 1024) throw new Error("备份文件超过 5MB，请选择较小文件。"); setPendingImport(parseBackup(await file.text(), market, mode)); }
    catch (e) { setImportError(e instanceof Error ? e.message : "备份格式不正确。"); }
    if (fileRef.current) fileRef.current.value = "";
  }
  const filtered = ledger.devices.filter(d => (category === "all" || d.category === category) && `${d.name} ${d.brand} ${d.model} ${d.configuration} ${d.tags ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const staleCount = ledger.devices.filter(d => { const v = latestValuation(d, ledger.valuations); return v && isStale(v); }).length;
  const latestDate = ledger.valuations.map(v => v.dataDate).sort().at(-1);
  const detailValuation = selected ? latestValuation(selected, ledger.valuations) : undefined;
  const detailMetrics = selected ? deviceMetrics(selected, detailValuation) : null;
  const detailHistory = selected ? ledger.valuations.filter(v => v.deviceId === selected.id && v.currency === selected.currency && v.region === selected.region && v.dataDate >= selected.purchaseDate) : [];

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setNav("overview"); }} aria-label="我的装备首页"><span className="brand-mark"><Box size={22} strokeWidth={1.7} /></span><span>我的装备<small>MY GEAR</small></span></a>
      <div className="workspace-label">个人设备账户</div>
      <nav aria-label="主导航"><button className={nav === "overview" ? "nav-item active" : "nav-item"} onClick={() => setNav("overview")}><LayoutGrid size={18} />装备总览<span className="nav-dot" /></button><button className={nav === "devices" ? "nav-item active" : "nav-item"} onClick={() => setNav("devices")}><Monitor size={18} />我的设备<span className="nav-count">{ready ? ledger.devices.length : "—"}</span></button><button className="nav-item" onClick={() => { setSettings(true); setPendingImport(null); setImportError(""); }}><HardDrive size={18} />数据与备份</button></nav>
      <div className="sidebar-bottom"><div className="private-note"><ShieldCheck size={19} /><strong>你的装备，你的数据</strong><p>仅保存在当前浏览器<br />无需账户，没有云同步</p><button onClick={() => setSettings(true)}>备份我的记录 <ArrowRight size={14} /></button></div><span className="version"><i />本地运行 <span>v0.1</span></span></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">个人空间 <ChevronRight size={13} /><span>{nav === "overview" ? "装备总览" : "我的设备"}</span></div><div className="topbar-right"><span className="market-label">{market.region === "CN" ? "中国大陆" : market.region === "US" ? "美国" : "中国香港"} · {market.currency}</span><button className="icon-button" aria-label="设置与备份" onClick={() => setSettings(true)}><Settings2 size={18} /></button><span className="avatar" aria-label="本地个人账户">我</span></div></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">A LITTLE CLARITY, FOR YOUR GEAR</div><h1>{nav === "overview" ? "每件装备，都心中有数。" : "你的设备，都在这里。"}</h1><p>{nav === "overview" ? "记录拥有，了解价值。看见装备陪伴你的每一天。" : "把购买信息、使用状态与参考估值放在一起。"}</p></div><button className="button primary add-button" disabled={!ready || !!loadError} onClick={() => setForm({})}><Plus size={18} />添加设备</button></div>
      <div className="workspace-bar"><div className="segmented" aria-label="数据空间"><button className={mode === "personal" ? "selected" : ""} onClick={() => changeMode("personal")}>我的设备</button><button className={mode === "demo" ? "selected" : ""} onClick={() => changeMode("demo")}><Sparkles size={13} />演示空间</button></div><span className="workspace-hint">{mode === "demo" ? "独立演示账户 · 不计入你的资产" : "个人账户 · 与演示数据完全隔离"}</span></div>
      {mode === "demo" && <div className="demo-banner"><span><Sparkles size={16} /><strong>演示数据，非真实行情</strong><span>5 件样例带你体验完整流程，价格与历史均为固定模拟数据。</span></span><button onClick={() => changeMode("personal")}>回到我的设备 <ArrowRight size={14} /></button></div>}
      {!ready ? <div className="loading-state" role="status"><LoaderCircle className="spin" />正在读取本地装备…</div> : loadError ? <div className="notice error"><h3>本地数据暂时无法读取</h3><p>{loadError}</p><p>为了保护原始记录，已暂停新增和覆盖。先导出原始数据，再检查浏览器存储权限或备份内容。</p><button className="button secondary" onClick={() => { try { downloadFile(localStorage.getItem(key) ?? "", "我的装备-原始恢复数据.json"); } catch { setToast({ message: "浏览器拒绝访问存储，请检查设置。", error: true }); } }}>导出原始数据</button></div> : <>
      {nav === "overview" && <>
        <section className="overview-grid" aria-label="装备价值总览">
          <div className="value-card"><div className="card-label"><span><span className="live-dot" />装备参考总值</span><span className="chip">{mode === "demo" ? "模拟估值" : "参考估值"}</span></div><div className="hero-value" data-testid="reference-total">{totals.referenceTotal === null ? <span className="no-value">等待第一笔估值</span> : money(totals.referenceTotal)}</div><div className="coverage"><span>已覆盖 <strong>{totals.valuedCount} / {totals.count}</strong> 件设备</span><span>未估值设备不计入</span></div><div className="coverage-track"><i style={{ width: `${totals.count ? totals.valuedCount / totals.count * 100 : 0}%` }} /></div><div className="value-bottom"><ShieldCheck size={14} /><span>{totals.referenceTotal === null ? "为设备添加参考估值，开始了解它的当前价值" : "区间估值按中值汇总 · 参考价值不等于可售金额"}</span></div></div>
          <div className="collection-card"><div><span className="eyebrow">BUILT AROUND YOUR EVERYDAY</span><h2>好装备，<br />值得好好记录。</h2><button className="text-button" onClick={() => setForm({ ai: true })}>用一句话添加 <Sparkles size={15} /></button></div><div className="gear-illustration" aria-hidden="true"><div className="draw-tablet"><div /><i /></div><div className="draw-laptop"><div><span /><span /><span /></div><i /></div><div className="draw-phone"><div /><i /></div><span className="orbit-dot one" /><span className="orbit-dot two" /></div></div>
        </section>
        <section className="stats-grid" aria-label="账户统计"><div className="stat-card"><span className="stat-icon"><Monitor size={19} /></span><div><p>拥有的设备</p><strong>{totals.count}<small> 件</small></strong><span className="stat-foot">陪伴日常的电子装备</span></div></div><div className="stat-card"><span className="stat-icon"><Wallet size={19} /></span><div><p>购入总金额</p><strong data-testid="purchase-total">{money(totals.purchaseTotal)}</strong><span className="stat-foot">全部 {totals.count} 件设备的购入成本</span></div></div><div className="stat-card"><span className="stat-icon">{(totals.change ?? 0) >= 0 ? <ArrowUpRight size={19} /> : <ArrowDownLeft size={19} />}</span><div><p>相较购入的价值变化</p><strong className={totals.change !== null && totals.change > 0 ? "positive" : ""} data-testid="total-change">{signed(totals.change)}{totals.changeRate !== null && <small className="change-rate">{percent(totals.changeRate)}</small>}</strong><span className="stat-foot">仅比较 {totals.valuedCount} 件已估值设备{totals.change !== null && totals.change > 0 ? " · 估值上升" : ""}</span></div></div></section>
      </>}
      <section className="devices-panel" aria-label="设备列表"><div className="devices-header"><div><h2>我的设备 <span>{ledger.devices.length.toString().padStart(2, "0")}</span></h2><p>每一件，都是日常的一部分。</p></div><button className="button secondary small" onClick={() => refresh()} disabled={refreshing || !ledger.devices.length}>{refreshing ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}{refreshing ? "刷新中…" : "刷新估值"}</button></div>
        <div className="list-toolbar"><div className="category-tabs" aria-label="按设备类别筛选"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>全部设备</button>{Object.entries(CATEGORIES).map(([id, label]) => <button key={id} className={category === id ? "active" : ""} onClick={() => setCategory(id)}>{label}</button>)}</div><label className="search-box"><Search size={16} /><input aria-label="搜索设备" placeholder="搜索名称、型号、标签" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="icon-button" aria-label="清除搜索" onClick={() => setSearch("")}><X size={13} /></button>}</label></div>
        {!ledger.devices.length ? <div className="empty-state"><span className="empty-icon"><Box size={34} strokeWidth={1.3} /></span><h3>给你的第一件装备一个位置</h3><p>从每天使用的手机开始，记录购买信息，<br />再慢慢建立自己的电子设备账户。</p><div><button className="button primary" onClick={() => setForm({})}><Plus size={16} />添加第一件设备</button>{mode === "personal" && <button className="button secondary" onClick={() => changeMode("demo")}>先体验演示 <ArrowRight size={15} /></button>}</div></div> : !filtered.length ? <div className="empty-state compact"><Search size={28} /><h3>没有找到符合条件的设备</h3><button className="text-button" onClick={() => { setCategory("all"); setSearch(""); }}>清除筛选</button></div> : <div className="device-table"><div className="table-head"><span>设备 / 配置</span><span>购入信息</span><span>当前参考值</span><span>价值变化</span><span /></div>{filtered.map(device => { const v = latestValuation(device, ledger.valuations); const metrics = deviceMetrics(device, v); return <button key={device.id} className="device-row" onClick={() => setSelectedId(device.id)} aria-label={`查看 ${device.name}`}><div className="device-identity"><DeviceIcon category={device.category} /><div><strong>{device.name}</strong><span>{device.model} · {device.configuration}</span><div className="device-tags"><em>{CATEGORIES[device.category]}</em>{device.tags && <em>{device.tags}</em>}</div></div></div><div className="table-cell purchase-cell"><span className="mobile-label">购入</span><strong>{money(device.purchasePrice)}</strong><small>{device.purchaseDate}</small></div><div className="table-cell value-cell"><span className="mobile-label">参考值</span><strong>{money(metrics.value)}</strong><small>{v ? <><i className={`source-dot ${v.provider}`} />{v.provider === "demo" ? "模拟行情" : "手动参考"}{isStale(v) && <em className="stale-label">已过期</em>}</> : <span className="unvalued">暂无估值</span>}</small></div><div className="table-cell change-cell"><span className="mobile-label">价值变化</span><strong className={metrics.change !== null && metrics.change > 0 ? "positive" : ""}>{signed(metrics.change)}</strong><small>{metrics.change === null ? "等待参考估值" : metrics.change > 0 ? `估值上升 · ${percent(metrics.changeRate)}` : percent(metrics.changeRate)}</small></div><ChevronRight className="row-chevron" size={17} /></button>; })}</div>}
        <div className="list-footer"><span><span className="live-dot" />{latestDate ? `最新数据日期 ${latestDate}` : "添加参考估值后显示数据日期"}{staleCount > 0 && ` · ${staleCount} 件估值超过七天`}</span><span>手动刷新 · 无后台自动更新</span></div>
      </section>
      <div className="bottom-note"><ShieldCheck size={15} /><span>记录仅保存在此浏览器，没有云同步。清除浏览器数据可能丢失记录。</span><button onClick={exportBackup}>导出 JSON 备份 <Download size={13} /></button></div>
      </>}
      <footer className="page-footer"><span>我的装备 <i>·</i> 少一点猜测，多一点了解。</span><button onClick={() => setSettings(true)}><CircleHelp size={14} />数据与计算说明</button></footer>
    </main></div>
    {toast && <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.error ? <CircleHelp size={18} /> : <Check size={18} />}<span>{toast.message}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setToast(null)}><X size={16} /></button></div>}
    {form && <Dialog title={form.device ? "编辑设备" : "添加一件新装备"} subtitle={mode === "demo" ? "演示空间 · 不影响个人记录" : `${activeMarket.label} · 保存到当前浏览器`} onClose={() => setForm(null)}><DeviceForm device={form.device} market={market} demo={mode === "demo"} startAI={form.ai} onSave={saveDevice} onCancel={() => setForm(null)} /></Dialog>}
    {selected && detailMetrics && !form && !valuationDevice && !deleting && <Dialog title="装备详情" subtitle={selected.demo ? "演示数据，非真实行情" : "个人设备 · 本地记录"} onClose={() => setSelectedId(null)} wide><div className="dialog-content detail-content"><div className="detail-title"><DeviceIcon category={selected.category} large /><div><span className="eyebrow">{CATEGORIES[selected.category]} / {selected.brand}</span><h2>{selected.name}</h2><p>{selected.model} · {selected.configuration}</p></div></div><div className="detail-value"><span>当前参考{detailValuation && detailValuation.low !== detailValuation.high ? "区间" : "价值"}</span><strong>{detailValuation ? detailValuation.low === detailValuation.high ? money(detailValuation.low) : `${money(detailValuation.low)} – ${money(detailValuation.high)}` : "暂无估值"}</strong><p>{detailValuation ? `${PRICE_TYPES[detailValuation.priceType]} · ${detailValuation.region} / ${detailValuation.currency} · 数据日期 ${detailValuation.dataDate}` : "型号缺少可靠报价时不猜测价格，你可以手动添加参考估值。"}</p>{detailValuation && <p>来源：{detailValuation.provider === "manual" ? "用户填写 · " : ""}{detailValuation.source} {isStale(detailValuation) && <span className="stale-label">超过七天，建议复核</span>}</p>}<div className="detail-actions"><button className="button primary small" onClick={() => setValuationDevice(selected)}><Plus size={15} />填写参考估值</button><button className="button secondary small" disabled={refreshing} onClick={() => refresh(selected)}><RefreshCw size={14} className={refreshing ? "spin" : ""} />刷新估值</button></div></div><div className="detail-metrics"><div><span>相较购入的价值变化</span><strong className={(detailMetrics.change ?? 0) > 0 ? "positive" : ""}>{signed(detailMetrics.change)}</strong><small>{(detailMetrics.change ?? 0) > 0 ? "估值上升，非已实现收益" : "估值变化，非已实现支出"}</small></div><div><span>价值变化率</span><strong>{detailMetrics.changeRate === null ? "—" : percent(detailMetrics.changeRate)}</strong><small>{selected.purchasePrice === 0 ? "买入价为零，不计算百分比" : "相较同一设备的买入价"}</small></div><div><span>日均估算持有成本</span><strong>{money(detailMetrics.dailyCost, 2)}<small> / 天</small></strong><small>{(detailMetrics.dailyCost ?? 0) < 0 ? "负值表示估值上升" : `按 ${detailMetrics.holdingDays} 天估算 · 当天按 1 天`}</small></div></div><div className="section-heading spaced"><h3>价值历史</h3><span className="chip">{selected.demo ? "演示数据，非真实行情" : "已保存的快照"}</span></div><HistoryChart valuations={detailHistory} currency={selected.currency} demo={!!selected.demo} />{detailHistory.length > 0 && <details className="snapshot-details"><summary>查看全部 {detailHistory.length} 条估值记录</summary><div className="snapshot-list">{[...detailHistory].sort((a, b) => b.dataDate.localeCompare(a.dataDate) || b.recordedAt.localeCompare(a.recordedAt)).map(v => <div key={v.id}><span>{v.dataDate}<small>{v.provider === "demo" ? "模拟 · " : "手动 · "}{v.source}</small></span><strong>{money(v.low)}{v.high !== v.low ? ` – ${money(v.high)}` : ""}<small>中值 {money(midpoint(v))}</small></strong></div>)}</div></details>}<div className="purchase-info"><h3>购买与使用信息</h3><dl><div><dt>购买日期</dt><dd>{selected.purchaseDate}</dd></div><div><dt>购买价格</dt><dd>{money(selected.purchasePrice)}</dd></div><div><dt>成色</dt><dd>{selected.condition || "未填写"}</dd></div>{selected.category !== "gpu" && <div><dt>电池状态</dt><dd>{selected.battery || "未填写"}</dd></div>}{selected.tags && <div className="full"><dt>标签</dt><dd>{selected.tags}</dd></div>}{selected.notes && <div className="full"><dt>备注</dt><dd>{selected.notes}</dd></div>}</dl></div><p className="calculation-note">计算说明：区间使用中值。价值变化 = 参考中值 − 买入价；变化率 = 价值变化 ÷ 买入价；日均估算持有成本 =（买入价 − 参考中值）÷ 持有天数。只反映估值变化，不含未记录的维修费、手续费等，不代表已实现支出或收益。</p></div><footer className="dialog-footer between"><button className="button danger-ghost" onClick={() => setDeleting(selected)}><Trash2 size={15} />删除设备</button><button className="button secondary" onClick={() => setForm({ device: selected })}>编辑设备</button></footer></Dialog>}
    {valuationDevice && <Dialog title="添加参考估值" subtitle={valuationDevice.name} onClose={() => setValuationDevice(null)}><ValuationForm device={valuationDevice} onCancel={() => setValuationDevice(null)} onSave={v => { if (commit({ ...ledger, valuations: [...ledger.valuations, v] })) { setValuationDevice(null); setToast({ message: "参考估值已保存，历史新增一个记录点。" }); } }} /></Dialog>}
    {deleting && <Dialog title="删除这件设备？" subtitle="删除前，请确认是否已导出需要的记录。" onClose={() => setDeleting(null)}><div className="dialog-content"><p>“{deleting.name}”及其 {ledger.valuations.filter(v => v.deviceId === deleting.id).length} 条估值记录将从{mode === "demo" ? "演示空间" : "个人空间"}中删除。此操作无法撤销。</p></div><footer className="dialog-footer"><button className="button secondary" onClick={() => setDeleting(null)}>保留设备</button><button className="button danger" onClick={() => { if (commit({ ...ledger, devices: ledger.devices.filter(d => d.id !== deleting.id), valuations: ledger.valuations.filter(v => v.deviceId !== deleting.id) })) { setDeleting(null); setSelectedId(null); setToast({ message: "设备及关联估值已删除。" }); } }}>确认删除</button></footer></Dialog>}
    {settings && <Dialog title="数据与备份" subtitle="本地优先，记录由你掌握。" onClose={() => { setSettings(false); setPendingImport(null); }}><div className="dialog-content settings-content"><div className="notice"><ShieldCheck size={19} /><div><strong>当前没有云同步</strong><p>设备与估值保存在此浏览器的 localStorage 中。不同浏览器或访问地址的数据相互独立。清除浏览器数据可能导致记录丢失，请定期导出备份。</p></div></div><section><h3>地区与币种</h3><p>不同市场分开建账，不进行汇率转换或跨市场价格汇总。</p><label>个人账户市场<select disabled={mode === "demo"} value={marketId} onChange={e => { savePreference(mode, e.target.value); setMarketId(e.target.value); setPendingImport(null); setImportError(""); setSearch(""); setCategory("all"); }}>{MARKETS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>{mode === "demo" && <p className="tiny muted">演示空间固定为中国大陆 / CNY；切回个人空间后可选择市场。</p>}</section><section><h3>JSON 备份与恢复</h3><p>只导出当前空间和市场。恢复需与当前空间、地区、币种一致。</p><div className="button-row"><button className="button primary" disabled={!ready || !!loadError} onClick={exportBackup}><Download size={16} />导出 JSON</button><button className="button secondary" disabled={!ready || !!loadError} onClick={() => fileRef.current?.click()}><Upload size={16} />导入备份</button><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={e => readBackup(e.target.files?.[0])} /></div>{importError && <div className="notice error" role="alert">{importError}</div>}{pendingImport && <div className="notice"><p>已检查备份：{pendingImport.devices.length} 件设备、{pendingImport.valuations.length} 条估值。恢复会替换当前空间的全部记录，请先导出当前数据。</p><div className="button-row"><button className="button primary small" onClick={() => { if (commit(pendingImport)) { setPendingImport(null); setToast({ message: "备份已恢复。" }); } }}>确认替换当前记录</button><button className="button secondary small" onClick={() => setPendingImport(null)}>取消恢复</button></div></div>}</section><section><h3>关于参考估值</h3><p>本版本提供固定模拟行情与手动参考估值，没有接入实时交易平台。超过七天的快照会提示过期；刷新没有新数据时，日期与价格均保持不变。</p><p>缺失估值不按零元计入总值。变化金额与变化率只比较已估值设备的参考中值与其购入金额。日均成本不是已发生的消费或收入。</p></section><section><h3>AI 辅助录入</h3><p>默认关闭。管理员在服务端配置后，只在你主动点击提取时发送输入文字。AI 仅辅助填写，检查确认后才保存；不会生成市场估值。</p></section></div><footer className="dialog-footer"><button className="button primary" onClick={() => setSettings(false)}>完成</button></footer></Dialog>}
  </div>;
}
