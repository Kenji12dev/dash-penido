import { useEffect, useState } from "react";
import { useSales } from "@/context/SalesContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface OverdueAlertsProps {
  onGoToKanban: () => void;
}

const OverdueAlerts = ({ onGoToKanban }: OverdueAlertsProps) => {
  const { sales } = useSales();
  const { user, role } = useAuth();
  const [collaboratorName, setCollaboratorName] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const fetchName = async () => {
      const { data } = await supabase
        .from("collaborators")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      setCollaboratorName(data?.name || null);
    };
    fetchName();
  }, [user]);

  // Admin sees all overdue, collaborators see only their own
  const now = new Date();
  const overdueSales = sales.filter((s) => {
    if (s.status !== "Pendente") return false;
    if (new Date(s.date) >= now) return false;
    if (dismissed.has(s.id)) return false;
    if (role === "admin") return true;
    if (!collaboratorName) return false;
    return s.closer === collaboratorName || s.sdr === collaboratorName;
  });

  if (overdueSales.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">
          Agendamentos pendentes ({overdueSales.length})
        </h3>
      </div>
      {overdueSales.slice(0, 5).map((sale) => (
        <div
          key={sale.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {sale.clientName} — {sale.product}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(sale.date), "dd MMM 'às' HH:mm", { locale: ptBR })} · Closer: {sale.closer} · SDR: {sale.sdr}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onGoToKanban}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Atualizar <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(sale.id))}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      {overdueSales.length > 5 && (
        <button
          onClick={onGoToKanban}
          className="text-xs text-primary hover:underline"
        >
          Ver mais {overdueSales.length - 5} agendamento(s) pendente(s)...
        </button>
      )}
    </div>
  );
};

export default OverdueAlerts;
