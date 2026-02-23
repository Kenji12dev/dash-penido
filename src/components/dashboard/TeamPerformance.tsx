import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { closerData, sdrData, CHART_COLORS } from "@/data/mockData";

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR")}`;

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 border border-glass-border text-sm">
      <p className="font-semibold text-foreground">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value.toFixed(1)}%</p>
    </div>
  );
};

const DonutChart = ({ data, dataKey }: { data: any[]; dataKey: string }) => (
  <div className="h-[200px]">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey={dataKey}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

const TeamPerformance = () => (
  <div
    className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-0 animate-fade-in"
    style={{ animationDelay: "600ms" }}
  >
    {/* Closers */}
    <div className="glass-card gradient-border p-6">
      <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-4">
        Performance — Closers
      </h2>
      <DonutChart data={closerData} dataKey="percentage" />
      <div className="mt-4 space-y-3">
        {closerData.map((c, i) => (
          <div key={c.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS[i] }}
              />
              <span className="text-foreground font-medium">{c.name}</span>
            </div>
            <div className="flex items-center gap-6 text-muted-foreground">
              <span>{c.sales} vendas</span>
              <span className="w-12 text-right">{c.percentage}%</span>
              <span className="w-28 text-right font-medium text-foreground">
                {formatCurrency(c.revenue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* SDRs */}
    <div className="glass-card gradient-border p-6">
      <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-4">
        Performance — SDRs
      </h2>
      <DonutChart data={sdrData} dataKey="percentage" />
      <div className="mt-4 space-y-3">
        {sdrData.map((s, i) => (
          <div key={s.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS[i] }}
              />
              <span className="text-foreground font-medium">{s.name}</span>
            </div>
            <div className="flex items-center gap-6 text-muted-foreground">
              <span>{s.meetings} reuniões</span>
              <span className="w-12 text-right">{s.percentage}%</span>
              <span className="w-20 text-right font-medium text-foreground">
                {s.conversion}% conv.
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default TeamPerformance;
