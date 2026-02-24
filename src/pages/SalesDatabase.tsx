import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSales } from "@/context/SalesContext";
import { Database, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  Pago: "text-success",
  Pendente: "text-warning",
  Cancelado: "text-destructive",
  Reembolsado: "text-muted-foreground",
};

const SalesDatabase = () => {
  const { sales, deleteSale } = useSales();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = sales.filter((s) => {
    const matchesSearch =
      !search ||
      s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.product.toLowerCase().includes(search.toLowerCase()) ||
      s.closer.toLowerCase().includes(search.toLowerCase()) ||
      s.sdr.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalNet = filtered.reduce((sum, s) => sum + s.netValue, 0);

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-[1440px] mx-auto space-y-6">
        {/* Header + Filters */}
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Banco de Dados — Vendas
            </h1>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              {filtered.length} registro{filtered.length !== 1 && "s"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, produto, closer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-border w-64"
                maxLength={100}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-secondary border-border w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
                <SelectItem value="Reembolsado">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card gradient-border overflow-hidden animate-fade-in">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Database className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {sales.length === 0
                  ? "Nenhuma venda registrada ainda"
                  : "Nenhum resultado encontrado"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bruto</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Líquido</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pagamento</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Closer</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SDR</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                        {format(new Date(s.date), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-5 py-3.5 text-foreground font-medium">{s.clientName}</td>
                      <td className="px-5 py-3.5 text-foreground">{s.product}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground whitespace-nowrap">
                        R$ {s.grossValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right text-foreground font-medium whitespace-nowrap">
                        R$ {s.netValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{s.paymentMethod}</td>
                      <td className="px-5 py-3.5 text-foreground">{s.closer}</td>
                      <td className="px-5 py-3.5 text-foreground">{s.sdr}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn("font-medium", statusColors[s.status] || "text-foreground")}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. A venda de {s.clientName} será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-secondary border-border">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteSale(s.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border">
                    <td colSpan={4} className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Líquido
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-foreground whitespace-nowrap">
                      R$ {totalNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesDatabase;
