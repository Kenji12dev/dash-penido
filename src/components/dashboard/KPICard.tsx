import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  change: number;
  delay?: number;
}

const KPICard = ({ label, value, change, delay = 0 }: KPICardProps) => {
  const isPositive = change >= 0;

  return (
    <div
      className="glass-card gradient-border p-6 flex flex-col gap-2 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
        {label}
      </span>
      <span className="text-3xl font-bold tracking-tight text-foreground">
        {value}
      </span>
      <div className="flex items-center gap-1.5 mt-1">
        {isPositive ? (
          <TrendingUp className="h-3.5 w-3.5 text-success" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
        )}
        <span
          className={cn(
            "text-xs font-medium",
            isPositive ? "text-success" : "text-destructive"
          )}
        >
          {isPositive ? "+" : ""}
          {change}%
        </span>
        <span className="text-xs text-muted-foreground">vs período anterior</span>
      </div>
    </div>
  );
};

export default KPICard;
