import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { paymentData } from "@/data/mockData";

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 border border-glass-border text-sm">
      <p className="font-semibold text-foreground">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].payload.percentage}%</p>
    </div>
  );
};

const PaymentDistribution = () => (
  <div
    className="glass-card gradient-border p-6 opacity-0 animate-fade-in"
    style={{ animationDelay: "800ms" }}
  >
    <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-4">
      Distribuição por Método de Pagamento
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={paymentData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {paymentData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        {paymentData.map((p) => (
          <div key={p.name} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-sm text-foreground font-medium">{p.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                R$ {p.value.toLocaleString("pt-BR")}
              </span>
              <span className="text-sm font-semibold text-foreground w-12 text-right">
                {p.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default PaymentDistribution;
