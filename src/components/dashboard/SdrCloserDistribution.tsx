import { CHART_COLORS, CLOSER_COLOR_MAP } from "@/data/mockData";
import { Users } from "lucide-react";

interface SdrCloserDistributionProps {
  data: Record<string, { closer: string; count: number; percentage: number }[]>;
}

const SdrCloserDistribution = ({ data }: SdrCloserDistributionProps) => {
  const sdrNames = Object.keys(data).sort();

  if (sdrNames.length === 0) {
    return (
      <div className="glass-card gradient-border p-6 opacity-0 animate-fade-in" style={{ animationDelay: "750ms" }}>
        <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-4">
          Distribuição SDR → Closer
        </h2>
        <div className="h-[120px] flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Users className="h-8 w-8 opacity-30" />
          <p className="text-sm">Sem dados no período</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card gradient-border p-6 opacity-0 animate-fade-in" style={{ animationDelay: "750ms" }}>
      <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-6">
        Distribuição SDR → Closer
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sdrNames.map((sdrName) => {
          const distribution = data[sdrName] || [];
          const totalCalls = distribution.reduce((sum, d) => sum + d.count, 0);
          return (
            <div key={sdrName} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground text-sm">{sdrName}</p>
                <span className="text-xs text-muted-foreground">{totalCalls} calls</span>
              </div>
              {distribution.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sem calls no período</p>
              ) : (
                <div className="space-y-2">
                  {distribution.map((d, i) => (
                    <div key={d.closer} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{d.closer}</span>
                        <span className="font-semibold text-foreground">
                          {d.count} ({d.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(d.percentage, 3)}%`,
                            backgroundColor: CLOSER_COLOR_MAP[d.closer] || CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SdrCloserDistribution;
