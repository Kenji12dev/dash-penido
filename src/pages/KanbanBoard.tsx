import { useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSales, Sale } from "@/context/SalesContext";
import { Columns3, GripVertical, Plus, CalendarIcon, Save, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import DateFilter from "@/components/dashboard/DateFilter";
import { PAYMENT_METHODS, LEAD_SOURCES, calculateNetValue, getFeeDescription } from "@/data/mockData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const statusColumns = [
  { id: "Pendente", label: "Agendado / Pendente", color: "border-yellow-500/60 bg-yellow-500/5" },
  { id: "Pago", label: "Pago", color: "border-emerald-500/60 bg-emerald-500/5" },
  { id: "Cancelado", label: "Cancelado", color: "border-red-500/60 bg-red-500/5" },
  { id: "Reembolsado", label: "Reembolsado", color: "border-zinc-500/60 bg-zinc-500/5" },
];

const KanbanBoard = () => {
  const { sales, addSale, updateSale, products, closers, sdrs } = useSales();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => startOfDay(subDays(new Date(), 30)));
  const [endDate, setEndDate] = useState(() => endOfDay(new Date()));

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newClient, setNewClient] = useState("");
  const [newProduct, setNewProduct] = useState("");
  const [newCloser, setNewCloser] = useState("");
  const [newSdr, setNewSdr] = useState("");
  const [newLeadSource, setNewLeadSource] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Move dialog (shown when dragging between columns)
  const [moveDialog, setMoveDialog] = useState<{ saleId: string; targetStatus: string } | null>(null);
  const [moveGross, setMoveGross] = useState("");
  const [movePayment, setMovePayment] = useState("");
  const [moveDownPayment, setMoveDownPayment] = useState("");

  // Detail dialog
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const filteredSales = sales.filter((s) => {
    const d = new Date(s.date);
    return d >= startDate && d <= endDate;
  });

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, saleId: string) => {
    setDraggedId(saleId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColId(colId);
  };
  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    if (!draggedId) return;
    const sale = sales.find((s) => s.id === draggedId);
    if (sale && sale.status !== targetStatus) {
      // Open move dialog so user can fill value/payment
      setMoveDialog({ saleId: draggedId, targetStatus });
      setMoveGross(sale.grossValue > 0 ? String(sale.grossValue) : "");
      setMovePayment(sale.paymentMethod || "");
      setMoveDownPayment(sale.downPayment ? String(sale.downPayment) : "");
    }
    setDraggedId(null);
    setDragOverColId(null);
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColId(null);
  };

  // Confirm move
  const handleMoveConfirm = () => {
    if (!moveDialog) return;
    const gross = parseFloat(moveGross) || 0;
    const net = movePayment ? calculateNetValue(gross, movePayment) : gross;
    const dp = parseFloat(moveDownPayment) || undefined;

    const updates: Partial<Omit<Sale, "id">> = { status: moveDialog.targetStatus };
    if (gross > 0) updates.grossValue = gross;
    if (net > 0) updates.netValue = net;
    if (movePayment) updates.paymentMethod = movePayment;
    if (dp) updates.downPayment = dp;

    updateSale(moveDialog.saleId, updates);
    toast.success(`Venda movida para ${moveDialog.targetStatus}`);
    setMoveDialog(null);
    setMoveGross("");
    setMovePayment("");
    setMoveDownPayment("");
  };

  const handleMoveSkip = () => {
    if (!moveDialog) return;
    updateSale(moveDialog.saleId, { status: moveDialog.targetStatus });
    toast.success(`Venda movida para ${moveDialog.targetStatus}`);
    setMoveDialog(null);
    setMoveGross("");
    setMovePayment("");
    setMoveDownPayment("");
  };

  const salesByStatus = (status: string) =>
    filteredSales
      .filter((s) => s.status === status)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Add new scheduling
  const resetAddForm = () => {
    setNewDate(new Date());
    setNewClient("");
    setNewProduct("");
    setNewCloser("");
    setNewSdr("");
    setNewLeadSource("");
    setNewNotes("");
  };

  const handleAddSave = () => {
    if (!newClient || !newProduct || !newCloser || !newSdr || !newLeadSource) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    addSale({
      date: newDate,
      clientName: newClient.trim(),
      product: newProduct,
      grossValue: 0,
      netValue: 0,
      paymentMethod: "",
      closer: newCloser,
      sdr: newSdr,
      status: "Pendente",
      leadSource: newLeadSource,
      notes: newNotes.trim(),
    });
    toast.success("Agendamento criado!");
    resetAddForm();
    setAddOpen(false);
  };

  // Detail card
  const openDetail = (sale: Sale) => {
    setDetailSale(sale);
    setEditNotes(sale.notes || "");
  };

  const saveDetail = () => {
    if (!detailSale) return;
    updateSale(detailSale.id, { notes: editNotes.trim() });
    toast.success("Informações atualizadas!");
    setDetailSale(null);
  };

  const moveSale = moveDialog ? sales.find((s) => s.id === moveDialog.saleId) : null;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Columns3 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Fluxo de Status
            </h1>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              {filteredSales.length} venda{filteredSales.length !== 1 && "s"}
            </span>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            size="sm"
            className="font-semibold"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Agendamento
          </Button>
        </div>

        <DateFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {statusColumns.map((col) => {
            const items = salesByStatus(col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverColId(null)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={cn(
                  "rounded-xl border-2 border-dashed p-3 min-h-[400px] transition-colors",
                  col.color,
                  draggedId && dragOverColId === col.id && "ring-2 ring-primary/40"
                )}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                  <span className="text-xs font-medium text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((sale) => (
                    <div
                      key={sale.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, sale.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => openDetail(sale)}
                      className={cn(
                        "bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:border-primary/30",
                        draggedId === sale.id && "opacity-40 scale-95"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {sale.clientName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {sale.product}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(sale.date), "dd/MM/yy", { locale: ptBR })}
                            </span>
                            {sale.grossValue > 0 && (
                              <span className="text-xs font-semibold text-foreground">
                                R$ {sale.grossValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">{sale.closer}</span>
                            {sale.paymentMethod && (
                              <span className="text-[10px] text-muted-foreground">{sale.paymentMethod}</span>
                            )}
                          </div>
                          {sale.notes && (
                            <p className="text-[10px] text-muted-foreground mt-1 truncate italic">
                              📝 {sale.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Scheduling Dialog — simplified, no value/payment */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>Preencha os dados do agendamento. Será criado como "Pendente".</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(newDate, "dd MMM yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Cliente *</Label>
              <Input placeholder="Nome do cliente" value={newClient} onChange={(e) => setNewClient(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Produto *</Label>
                <Select value={newProduct} onValueChange={setNewProduct}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Origem *</Label>
                <Select value={newLeadSource} onValueChange={setNewLeadSource}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{LEAD_SOURCES.map((ls) => <SelectItem key={ls} value={ls}>{ls}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Closer *</Label>
                <Select value={newCloser} onValueChange={setNewCloser}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{closers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">SDR *</Label>
                <Select value={newSdr} onValueChange={setNewSdr}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{sdrs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Observações</Label>
              <Textarea placeholder="Briefing, anotações..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddSave} className="flex-1 font-semibold">
                <Save className="h-4 w-4 mr-1" /> Criar Agendamento
              </Button>
              <Button variant="ghost" onClick={() => { resetAddForm(); setAddOpen(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Dialog — appears when dragging between columns */}
      <Dialog open={!!moveDialog} onOpenChange={(open) => { if (!open) { setMoveDialog(null); setMoveGross(""); setMovePayment(""); setMoveDownPayment(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              Mover para {moveDialog?.targetStatus}
            </DialogTitle>
            <DialogDescription>
              {moveSale ? `${moveSale.clientName} — ${moveSale.product}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Valor Bruto (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                value={moveGross}
                onChange={(e) => setMoveGross(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Método de Pagamento</Label>
              <Select value={movePayment} onValueChange={setMovePayment}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m} <span className="text-muted-foreground ml-1">({getFeeDescription(m)})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {movePayment === "TMB" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Valor de Entrada</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={moveDownPayment}
                  onChange={(e) => setMoveDownPayment(e.target.value)}
                />
              </div>
            )}
            {moveGross && movePayment && (
              <div className="text-xs text-muted-foreground bg-secondary rounded-lg p-3">
                Valor líquido: <span className="font-semibold text-foreground">R$ {calculateNetValue(parseFloat(moveGross) || 0, movePayment).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button onClick={handleMoveConfirm} className="flex-1 font-semibold">
                <Save className="h-4 w-4 mr-1" /> Confirmar
              </Button>
              <Button variant="outline" onClick={handleMoveSkip} className="text-muted-foreground">
                Pular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail / Edit Dialog */}
      <Dialog open={!!detailSale} onOpenChange={(open) => !open && setDetailSale(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {detailSale && (
            <>
              <DialogHeader>
                <DialogTitle>{detailSale.clientName}</DialogTitle>
                <DialogDescription>{detailSale.product} — {format(new Date(detailSale.date), "dd/MM/yyyy", { locale: ptBR })}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Status</span>
                    <p className="font-semibold text-foreground">{detailSale.status}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Valor Bruto</span>
                    <p className="font-semibold text-foreground">
                      {detailSale.grossValue > 0 ? `R$ ${detailSale.grossValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Pagamento</span>
                    <p className="font-medium text-foreground">{detailSale.paymentMethod || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Valor Líquido</span>
                    <p className="font-medium text-foreground">
                      {detailSale.netValue > 0 ? `R$ ${detailSale.netValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Closer</span>
                    <p className="font-medium text-foreground">{detailSale.closer}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">SDR</span>
                    <p className="font-medium text-foreground">{detailSale.sdr}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Origem</span>
                    <p className="font-medium text-foreground">{detailSale.leadSource}</p>
                  </div>
                  {detailSale.downPayment != null && detailSale.downPayment > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Entrada</span>
                      <p className="font-medium text-foreground">R$ {detailSale.downPayment.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Briefing / Anotações</Label>
                  <Textarea
                    placeholder="Adicione informações do cliente, briefing da call, observações..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                </div>

                <Button onClick={saveDetail} className="w-full font-semibold">
                  <Save className="h-4 w-4 mr-1" /> Salvar Alterações
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KanbanBoard;
