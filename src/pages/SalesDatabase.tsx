import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSales, Sale } from "@/context/SalesContext";
import { PAYMENT_METHODS, LEAD_SOURCES, calculateNetValue, getFeeDescription } from "@/data/mockData";
import { Database, Search, Trash2, Pencil, X, Check } from "lucide-react";
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
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  Pago: "text-success",
  Pendente: "text-warning",
  "Follow Up": "text-blue-500",
  Loss: "text-destructive",
  Reembolsado: "text-muted-foreground",
};

const statuses = ["Pago", "Pendente", "Follow Up", "Loss", "Reembolsado"];

const SalesDatabase = () => {
  const { sales, deleteSale, updateSale, products, closers, sdrs } = useSales();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Sale>>({});

  // Reset page when filters change
  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };
  const handleStatusFilter = (v: string) => { setStatusFilter(v); setCurrentPage(1); };

  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = sales
    .filter((s) => {
      const matchesSearch =
        !search ||
        s.clientName.toLowerCase().includes(search.toLowerCase()) ||
        s.product.toLowerCase().includes(search.toLowerCase()) ||
        s.closer.toLowerCase().includes(search.toLowerCase()) ||
        s.sdr.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalNet = filtered.reduce((sum, s) => sum + s.netValue, 0);

  const startEdit = (sale: Sale) => {
    setEditingId(sale.id);
    setEditData({
      clientName: sale.clientName,
      product: sale.product,
      grossValue: sale.grossValue,
      downPayment: sale.downPayment,
      paymentMethod: sale.paymentMethod,
      closer: sale.closer,
      sdr: sale.sdr,
      status: sale.status,
      leadSource: sale.leadSource,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const netValue = editData.paymentMethod && editData.grossValue
      ? calculateNetValue(editData.grossValue, editData.paymentMethod)
      : undefined;
    await updateSale(editingId, { ...editData, ...(netValue !== undefined ? { netValue } : {}) });
    toast.success("Venda atualizada!");
    cancelEdit();
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-10">
      <div className="max-w-[1440px] mx-auto space-y-6">
        {/* Header + Filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Banco de Dados
            </h1>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              {filtered.length}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 bg-secondary border-border w-full sm:w-64"
                maxLength={100}
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger className="bg-secondary border-border w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Follow Up">Follow Up</SelectItem>
                <SelectItem value="Loss">Loss</SelectItem>
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
                    <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Entrada</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Líquido</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pagamento</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Closer</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SDR</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Origem</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                        {format(new Date(s.date), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-5 py-3.5 text-foreground font-medium">
                        {editingId === s.id ? (
                          <Input
                            value={editData.clientName || ""}
                            onChange={(e) => setEditData({ ...editData, clientName: e.target.value })}
                            className="h-8 bg-secondary border-border text-sm w-32"
                          />
                        ) : s.clientName}
                      </td>
                      <td className="px-5 py-3.5 text-foreground">
                        {editingId === s.id ? (
                          <Select value={editData.product || ""} onValueChange={(v) => setEditData({ ...editData, product: v })}>
                            <SelectTrigger className="h-8 bg-secondary border-border text-sm w-36"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover border-border z-50">
                              {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : s.product}
                      </td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground whitespace-nowrap">
                        {editingId === s.id ? (
                          <Input
                            type="number"
                            value={editData.grossValue || ""}
                            onChange={(e) => setEditData({ ...editData, grossValue: parseFloat(e.target.value) || 0 })}
                            className="h-8 bg-secondary border-border text-sm w-24 text-right"
                          />
                        ) : `R$ ${s.grossValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground whitespace-nowrap">
                        {editingId === s.id && (editData.paymentMethod || s.paymentMethod) === "TMB" ? (
                          <Input
                            type="number"
                            value={editData.downPayment ?? ""}
                            onChange={(e) => setEditData({ ...editData, downPayment: parseFloat(e.target.value) || 0 })}
                            className="h-8 bg-secondary border-border text-sm w-24 text-right"
                            placeholder="Entrada"
                          />
                        ) : s.paymentMethod === "TMB" && s.downPayment != null
                          ? `R$ ${s.downPayment.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-foreground font-medium whitespace-nowrap">
                        {editingId === s.id
                          ? `R$ ${(editData.paymentMethod && editData.grossValue ? calculateNetValue(editData.grossValue, editData.paymentMethod) : s.netValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : `R$ ${s.netValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {editingId === s.id ? (
                          <Select value={editData.paymentMethod || ""} onValueChange={(v) => setEditData({ ...editData, paymentMethod: v })}>
                            <SelectTrigger className="h-8 bg-secondary border-border text-sm w-32"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover border-border z-50">
                              {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : s.paymentMethod}
                      </td>
                      <td className="px-5 py-3.5 text-foreground">
                        {editingId === s.id ? (
                          <Select value={editData.closer || ""} onValueChange={(v) => setEditData({ ...editData, closer: v })}>
                            <SelectTrigger className="h-8 bg-secondary border-border text-sm w-28"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover border-border z-50">
                              {closers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : s.closer}
                      </td>
                      <td className="px-5 py-3.5 text-foreground">
                        {editingId === s.id ? (
                          <Select value={editData.sdr || ""} onValueChange={(v) => setEditData({ ...editData, sdr: v })}>
                            <SelectTrigger className="h-8 bg-secondary border-border text-sm w-24"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover border-border z-50">
                              {sdrs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : s.sdr}
                      </td>
                      <td className="px-5 py-3.5 text-foreground">
                        {editingId === s.id ? (
                          <Select value={editData.leadSource || ""} onValueChange={(v) => setEditData({ ...editData, leadSource: v })}>
                            <SelectTrigger className="h-8 bg-secondary border-border text-sm w-28"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover border-border z-50">
                              {LEAD_SOURCES.map((ls) => <SelectItem key={ls} value={ls}>{ls}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : s.leadSource}
                      </td>
                      <td className="px-5 py-3.5">
                        {editingId === s.id ? (
                          <Select value={editData.status || ""} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                            <SelectTrigger className="h-8 bg-secondary border-border text-sm w-28"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover border-border z-50">
                              {statuses.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn("font-medium", statusColors[s.status] || "text-foreground")}>
                            {s.status}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {editingId === s.id ? (
                            <>
                              <button onClick={saveEdit} className="text-success hover:text-success/80 transition-colors">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={cancelEdit} className="text-muted-foreground hover:text-destructive transition-colors">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(s)} className="text-muted-foreground hover:text-primary transition-colors">
                                <Pencil className="h-4 w-4" />
                              </button>
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
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border">
                    <td colSpan={5} className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Líquido
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-foreground whitespace-nowrap">
                      R$ {totalNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={6}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-md bg-secondary text-foreground disabled:opacity-40 hover:bg-secondary/80 transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-md bg-secondary text-foreground disabled:opacity-40 hover:bg-secondary/80 transition-colors"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesDatabase;
