import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Inbox } from "lucide-react";
import type { LeadFunnel } from "@/hooks/useDashboardMetrics";
import { duracao } from "@/lib/tempo";

const fmtMin = (m: number | null) => (m === null ? "—" : duracao(new Date(0), new Date(m * 60000)));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
  return (
    <div className="glass-card p-3 border border-glass-border text-sm">
      <p className="font-semibold text-foreground">
        {label} — {total} {total === 1 ? "lead" : "leads"}
      </p>
      {payload
        .filter((p: any) => p.value > 0)
        .map((p: any) => (
          <p key={p.dataKey} className="text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            {p.dataKey}: {p.value}
          </p>
        ))}
    </div>
  );
};

interface LeadFunnelChartProps {
  data: LeadFunnel;
}

/**
 * Aplicacoes que chegaram pelos formularios (Respondi) no periodo, por estagio
 * atual (aguardando, ativado, agendado, descartado), empilhadas por origem.
 * Barra horizontal porque o eixo e categoria + magnitude e os rotulos dos
 * estagios cabem inteiros; a legenda existe porque ha mais de uma serie.
 */
const LeadFunnelChart = ({ data }: LeadFunnelChartProps) => {
  const chartData = data.stages.map((s) => ({ name: s.label, ...s.byOrigin }));
  const multiOrigin = data.origins.length > 1;

  return (
    <div className="glass-card gradient-border p-6 opacity-0 animate-fade-in" style={{ animationDelay: "500ms" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground">
          Funil de leads
        </h2>
        {multiOrigin && (
          <div className="flex items-center gap-4">
            {data.origins.map((o) => (
              <span key={o.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                {o.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {data.total === 0 ? (
        <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Inbox className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum lead no período</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            <div className="rounded-lg bg-secondary/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Leads</p>
              <p className="text-xl font-bold text-foreground">{data.total}</p>
            </div>
            {data.stages.map((s) => (
              <div key={s.key} className="rounded-lg bg-secondary/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold text-foreground">
                  {s.count}
                  <span className="ml-1.5 text-xs font-medium text-muted-foreground">{s.percentage}%</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mb-5 rounded-lg bg-secondary/40 px-3 py-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tempo até ativar</p>
            <p className="text-sm text-foreground">
              mediana <span className="font-bold">{fmtMin(data.ativacao.medianaMin)}</span>
            </p>
            <p className="text-sm text-foreground">
              média <span className="font-bold">{fmtMin(data.ativacao.mediaMin)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {data.ativacao.amostra} {data.ativacao.amostra === 1 ? "lead medido" : "leads medidos"}
            </p>
          </div>

          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barSize={18}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(215, 15%, 65%)", fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(340, 10%, 18%)" }} />
                {data.origins.map((o, i) => (
                  <Bar
                    key={o.name}
                    dataKey={o.name}
                    stackId="leads"
                    fill={o.color}
                    // Canto arredondado so na ponta da pilha, para a barra ler como uma.
                    radius={i === data.origins.length - 1 ? [0, 4, 4, 0] : 0}
                  >
                    {chartData.map((row) => (
                      <Cell key={row.name} stroke="hsl(340, 8%, 8%)" strokeWidth={2} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default LeadFunnelChart;
