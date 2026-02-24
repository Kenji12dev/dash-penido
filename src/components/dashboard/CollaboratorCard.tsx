import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface CollaboratorCardProps {
  name: string;
  fixedSalary: number;
  commissionRate: number;
  totalSales: number;
  caixaGerado: number;
  totalRevenue: number;
  onEdit: () => void;
}

const formatPercent = (rate: number) => `${(rate * 100).toFixed(0)}%`;
const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CollaboratorCard = ({
  name,
  fixedSalary,
  commissionRate,
  totalSales,
  caixaGerado,
  totalRevenue,
  onEdit,
}: CollaboratorCardProps) => {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-foreground">{name}</span>
        <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Fixo</span>
          <p className="font-medium text-foreground">{fixedSalary > 0 ? formatCurrency(fixedSalary) : "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Comissão</span>
          <p className="font-medium text-foreground">{formatPercent(commissionRate)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Vendas (Pago)</span>
          <p className="font-medium text-foreground">{totalSales}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Caixa Gerado</span>
          <p className="font-medium text-foreground">{formatCurrency(caixaGerado)}</p>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Receita Líquida</span>
          <p className="font-medium text-foreground">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>
    </div>
  );
};

export default CollaboratorCard;
