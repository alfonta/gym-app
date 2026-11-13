// Small dependency-free SVG charts. Rendered LTR (time flows left → right).

interface LinePoint { label: string; value: number; trend: number }

export function WeightChart({ points, goal }: { points: LinePoint[]; goal: number | null }) {
  const W = 340, H = 170, L = 34, R = 10, T = 12, B = 22;
  if (points.length === 0) return <div className="chart-empty">עדיין אין שקילות. הזן משקל בוקר כדי להתחיל.</div>;
  const values = points.flatMap((p) => [p.value, p.trend]).concat(goal ? [goal] : []);
  let min = Math.min(...values), max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.15);
  min -= pad; max += pad;
  const x = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : (i / (points.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  // Catmull-Rom → cubic bezier for a smoothed trend line.
  const pts = points.map((p, i) => [x(i), y(p.trend)] as const);
  let d = pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  const ticks = [min + pad, (min + max) / 2, max - pad];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ direction: "ltr" }} role="img" aria-label="גרף מגמת משקל">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">{t.toFixed(1)}</text>
        </g>
      ))}
      {goal !== null && goal > 0 && (
        <g>
          <line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} className="goal" />
          <text x={W - R} y={y(goal) - 5} textAnchor="end" className="goal-label">יעד {goal}</text>
        </g>
      )}
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} className="raw" />)}
      <path d={d} className="trend" />
      <text x={L} y={H - 5} className="axis">{points[0].label}</text>
      {points.length > 1 && <text x={W - R} y={H - 5} textAnchor="end" className="axis">{points[points.length - 1].label}</text>}
    </svg>
  );
}

export function BarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const W = 340, H = 150, L = 8, R = 8, T = 18, B = 22;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const bw = (W - L - R) / bars.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ direction: "ltr" }} role="img" aria-label="גרף נפח שבועי">
      {bars.map((b, i) => {
        const h = (b.value / max) * (H - T - B);
        return (
          <g key={i}>
            <rect x={L + i * bw + 5} y={H - B - h} width={bw - 10} height={Math.max(h, 1)} rx={4} className={i === bars.length - 1 ? 'bar cur' : 'bar'} />
            {b.value > 0 && <text x={L + i * bw + bw / 2} y={H - B - h - 4} textAnchor="middle" className="axis">{b.value >= 1000 ? `${(b.value / 1000).toFixed(1)}k` : b.value}</text>}
            <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="axis">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
