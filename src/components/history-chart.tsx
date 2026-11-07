import type { Currency, Valuation } from "@/lib/types";

export function HistoryChart({ valuations, currency, demo }: { valuations: Valuation[]; currency: Currency; demo: boolean }) {
  const points = [...valuations].sort((a, b) => a.dataDate.localeCompare(b.dataDate) || a.recordedAt.localeCompare(b.recordedAt));
  if (!points.length) return <div className="chart-empty"><span>还没有价值记录</span><p>添加一笔参考估值，这里就会留下第一个记录点。</p></div>;
  const values = points.map(p => (p.low + p.high) / 2);
  const min = Math.max(0, Math.min(...values) * .9);
  const max = Math.max(...values) * 1.1 || 1;
  const dates = points.map(p => Date.parse(`${p.dataDate}T00:00:00Z`));
  const span = dates[dates.length - 1] - dates[0];
  const coords = values.map((v, i) => ({ x: span ? 60 + (dates[i] - dates[0]) / span * 596 : 358, y: 160 - (v - min) / (max - min) * 130 }));
  return <div className="history-chart">
    <div className="chart-caption"><span><i />参考区间中值 · {currency}</span><span>{points.length} 条快照</span></div>
    <svg viewBox="0 0 700 205" role="img" aria-label={`价值历史，${points.length}条实际保存的估值快照；具体数值见下方记录表`}>
      {[0, 1, 2, 3].map(i => { const y = 30 + i * 43.33; return <g key={i}><line x1="60" x2="656" y1={y} y2={y} stroke="#e8ece9" strokeDasharray="4 5" /><text x="48" y={y + 4} textAnchor="end" fill="#89958f" fontSize="11">{Math.round(max - (max - min) * i / 3).toLocaleString()}</text></g>; })}
      {points.length > 1 && <><path d={`M${coords[0].x},160 ${coords.map(p => `L${p.x},${p.y}`).join(" ")} L${coords.at(-1)!.x},160 Z`} fill="#e7f1eb" /><polyline points={coords.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#367a5b" strokeWidth="2.5" strokeLinejoin="round" /></>}
      {coords.map((p, i) => <circle key={points[i].id} cx={p.x} cy={p.y} r="4.5" fill="#367a5b" stroke="white" strokeWidth="2"><title>{points[i].dataDate}：{values[i]} {currency}</title></circle>)}
      <text x="60" y="193" fill="#89958f" fontSize="11">{points[0].dataDate}</text>
      {span > 0 && <text x="656" y="193" textAnchor="end" fill="#89958f" fontSize="11">{points.at(-1)!.dataDate}</text>}
    </svg>
    <p className="muted tiny">{demo ? "演示数据，非真实行情。" : "仅连接已保存的估值快照，不代表期间的连续市场价格。"}{points.length === 1 ? "当前仅有一个记录点，尚无历史走势。" : "缺少数据的日期未补造记录。"}</p>
  </div>;
}
