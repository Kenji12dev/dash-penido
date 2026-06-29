import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart3 } from "lucide-react";

interface RevenueChartProps {
  data: { date: string; revenue: number }[];
}

const formatCurrency = (value: number) =>
  `R$ ${(value / 1000).toFixed(0)}k`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 border border-glass-border text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold text-foreground">
        R$ {payload[0].value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
};

const RevenueChart = ({ data }: RevenueChartProps) => (
  <div className="glass-card gradient-border p-6 opacity-0 animate-fade-in" style={{ animationDelay: "400ms" }}>
    <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-6">
      Faturamento no Período
    </h2>
    {data.length === 0 ? (
      <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
        <BarChart3 className="h-10 w-10 opacity-30" />
        <p className="text-sm">Nenhuma venda registrada ainda</p>
      </div>
    ) : (
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(190, 90%, 55%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(168, 75%, 48%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(190, 90%, 55%)" />
                <stop offset="100%" stopColor="hsl(168, 75%, 48%)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 14%, 16%)" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "hsl(200, 12%, 58%)", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(200, 12%, 58%)", fontSize: 12 }} tickFormatter={formatCurrency} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="url(#lineGradient)" strokeWidth={2.5} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

export default RevenueChart;
