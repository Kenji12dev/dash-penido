import { useState } from "react";
import { format, startOfDay, endOfDay, startOfMonth } from "date-fns";
import DateFilter from "@/components/dashboard/DateFilter";
import { ptBR } from "date-fns/locale";
import { useSales, Sale } from "@/context/SalesContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Columns3, GripVertical, Plus, CalendarIcon, Save, X, ArrowRight, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { PAYMENT_METHODS, LEAD_SOURCES, calculateNetValue, getFeeDescription, HybridPayment, calculateHybridNetValue, calculateHybridCaixa } from "@/data/mockData";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColumns = [
  { id: "Pendente", label: "Agendado / Pendente", color: "border-yellow-500/60 bg-yellow-500/5" },
  { id: "Pago", label: "Pago", color: "border-emerald-500/60 bg-emerald-500/5" },
  { id: "Loss", label: "Loss", color: "border-red-500/60 bg-red-500/5" },
  { id: "Follow Up", label: "Follow Up", color: "border-blue-500/60 bg-blue-500/5" },
  { id: "No Show", label: "No Show", color: "border-orange-500/60 bg-orange-500/5" },
  { id: "Reembolsado", label: "Reembolsado", color: "border-zinc-500/60 bg-zinc-500/5" },
];

const KanbanBoard = () => {
  const { sales, addSale, updateSale, deleteSale, products, closers, sdrs } = useSales();
  const { role } = useAuth();
  const isViewer = role === "visualizador";
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [sdrFilter, setSdrFilter] = useState("all");
  const [closerFilter, setCloserFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("11:00");
  const [newClient, setNewClient] = useState("");
  const [newProduct, setNewProduct] = useState("");
  const [newCloser, setNewCloser] = useState("");
  const [newSdr, setNewSdr] = useState("");
  const [newLeadSource, setNewLeadSource] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Move dialog
  const [moveDialog, setMoveDialog] = useState<{ saleId: string; targetStatus: string } | null>(null);
  const [moveGross, setMoveGross] = useState("");
  const [movePayment, setMovePayment] = useState("");
  const [moveDownPayment, setMoveDownPayment] = useState("");
  const [moveHybridPayments, setMoveHybridPayments] = useState<HybridPayment[]>([
    { method: "", value: 0 },
    { method: "", value: 0 },
  ]);

  // Follow Up dialog
  const [followUpDialog, setFollowUpDialog] = useState<{ saleId: string } | null>(null);
  const [followUpDate, setFollowUpDate] = useState<Date>(new Date());
  const [followUpStartTime, setFollowUpStartTime] = useState("10:00");
  const [followUpEndTime, setFollowUpEndTime] = useState("11:00");

  // Detail dialog (editable)
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editProduct, setEditProduct] = useState("");
  const [editCloser, setEditCloser] = useState("");
  const [editSdr, setEditSdr] = useState("");
  const [editLeadSource, setEditLeadSource] = useState("");
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editStartTime, setEditStartTime] = useState("10:00");
  const [editEndTime, setEditEndTime] = useState("11:00");

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredSales = sales.filter((s) => {
    const matchesSearch = !search || s.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesSdr = sdrFilter === "all" || s.sdr === sdrFilter;
    const matchesCloser = closerFilter === "all" || s.closer === closerFilter;
    const matchesPayment = paymentFilter === "all" || s.paymentMethod === paymentFilter;
    const saleDate = new Date(s.date);
    const matchesDate = saleDate >= startOfDay(startDate) && saleDate <= endOfDay(endDate);
    return matchesSearch && matchesSdr && matchesCloser && matchesPayment && matchesDate;
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
      if (targetStatus === "Loss" || targetStatus === "No Show") {
        updateSale(draggedId, { status: targetStatus });
        toast.success(`Venda movida para ${targetStatus}`);
      } else if (targetStatus === "Follow Up") {
        setFollowUpDialog({ saleId: draggedId });
      } else {
        setMoveDialog({ saleId: draggedId, targetStatus });
        setMoveGross(sale.grossValue > 0 ? String(sale.grossValue) : "");
        setMovePayment(sale.paymentMethod || "");
        setMoveDownPayment(sale.downPayment ? String(sale.downPayment) : "");
      }
    }
    setDraggedId(null);
    setDragOverColId(null);
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColId(null);
  };

  const NON_HYBRID_METHODS = PAYMENT_METHODS.filter(m => m !== "Venda Híbrida");

  const handleMoveConfirm = () => {
    if (!moveDialog) return;
    const isHybrid = movePayment === "Venda Híbrida";

    if (isHybrid) {
      const validPayments = moveHybridPayments.filter(p => p.method && p.value > 0);
      if (validPayments.length < 2) {
        toast.error("Venda Híbrida precisa de pelo menos 2 métodos.");
        return;
      }
      const hybridTotal = validPayments.reduce((s, p) => s + p.value, 0);
      const hybridNet = calculateHybridNetValue(validPayments);
      updateSale(moveDialog.saleId, {
        status: moveDialog.targetStatus,
        grossValue: hybridTotal,
        netValue: hybridNet,
        paymentMethod: "Venda Híbrida",
        hybridPayments: validPayments,
      });
    } else {
      const gross = parseFloat(moveGross) || 0;
      const net = movePayment ? calculateNetValue(gross, movePayment) : gross;
      const dp = parseFloat(moveDownPayment) || undefined;

      const updates: Partial<Omit<Sale, "id">> = { status: moveDialog.targetStatus };
      if (gross > 0) updates.grossValue = gross;
      if (net > 0) updates.netValue = net;
      if (movePayment) updates.paymentMethod = movePayment;
      if (dp) updates.downPayment = dp;

      updateSale(moveDialog.saleId, updates);
    }

    toast.success(`Venda movida para ${moveDialog.targetStatus}`);
    resetMoveDialog();
  };

  const resetMoveDialog = () => {
    setMoveDialog(null);
    setMoveGross("");
    setMovePayment("");
    setMoveDownPayment("");
    setMoveHybridPayments([{ method: "", value: 0 }, { method: "", value: 0 }]);
  };

  const handleMoveSkip = () => {
    if (!moveDialog) return;
    updateSale(moveDialog.saleId, { status: moveDialog.targetStatus });
    toast.success(`Venda movida para ${moveDialog.targetStatus}`);
    resetMoveDialog();
  };

  // Follow Up confirm
  const handleFollowUpConfirm = async () => {
    if (!followUpDialog) return;
    const sale = sales.find((s) => s.id === followUpDialog.saleId);
    updateSale(followUpDialog.saleId, { status: "Follow Up", date: followUpDate });
    toast.success("Movido para Follow Up");

    // Create calendar event for follow-up
    if (sale) {
      try {
        const { data, error } = await supabase.functions.invoke("google-calendar-event", {
          body: {
            collaborator_name: sale.closer,
            client_name: sale.clientName,
            product: sale.product,
            date: followUpDate.toISOString(),
            start_time: followUpStartTime,
            end_time: followUpEndTime,
            notes: `Follow Up — ${sale.notes || ""}`.trim(),
          },
        });
        console.log("Follow-up Calendar response:", { data, error });
        if (data?.success) {
          toast.success("📅 Follow Up agendado no Google Calendar!", { duration: 4000 });
        } else if (data?.skipped) {
          toast.warning(data?.error || "Google Calendar não vinculado para este closer", { duration: 5000 });
        } else if (error || data?.error) {
          toast.warning("Falha ao criar evento de Follow Up: " + (data?.error || error?.message), { duration: 5000 });
        }
      } catch (err) {
        console.warn("Calendar integration error:", err);
      }
    }

    setFollowUpDialog(null);
    setFollowUpDate(new Date());
    setFollowUpStartTime("10:00");
    setFollowUpEndTime("11:00");
  };

  // Delete
  const handleDelete = () => {
    if (!deleteId) return;
    deleteSale(deleteId);
    toast.success("Agendamento excluído");
    setDeleteId(null);
    setDetailSale(null);
  };

  const salesByStatus = (status: string) =>
    filteredSales
      .filter((s) => s.status === status)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Add new scheduling
  const resetAddForm = () => {
    setNewDate(new Date());
    setNewStartTime("10:00");
    setNewEndTime("11:00");
    setNewClient("");
    setNewProduct("");
    setNewCloser("");
    setNewSdr("");
    setNewLeadSource("");
    setNewNotes("");
  };

  const handleAddSave = async () => {
    if (!newClient || !newProduct || !newCloser || !newSdr || !newLeadSource) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const createdSale = await addSale({
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

    if (!createdSale) return;
    toast.success("Agendamento criado!");

    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-event", {
        body: {
          collaborator_name: newCloser,
          client_name: newClient.trim(),
          product: newProduct,
          date: newDate.toISOString(),
          start_time: newStartTime,
          end_time: newEndTime,
          notes: newNotes.trim(),
          sdr: newSdr,
        },
      });
      console.log("Calendar response:", { data, error });
      if (data?.success) {
        toast.success("📅 Evento criado no Google Calendar!", { duration: 4000 });
      } else if (data?.skipped) {
        toast.warning(data?.error || "Google Calendar não vinculado para este closer", { duration: 5000 });
      } else if (error || data?.error) {
        toast.warning("Falha ao criar evento no Calendar: " + (data?.error || error?.message), { duration: 5000 });
      }
    } catch (err) {
      console.warn("Calendar integration error:", err);
    }

    resetAddForm();
    setAddOpen(false);
  };

  // Detail card
  const openDetail = (sale: Sale) => {
    setDetailSale(sale);
    setEditNotes(sale.notes || "");
    setEditClient(sale.clientName);
    setEditProduct(sale.product);
    setEditCloser(sale.closer);
    setEditSdr(sale.sdr);
    setEditLeadSource(sale.leadSource);
    setEditDate(new Date(sale.date));
    // Extract time from the date
    const d = new Date(sale.date);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setEditStartTime(`${hh}:${mm}`);
    // Default end time to 1 hour after start
    const end = new Date(d.getTime() + 60 * 60 * 1000);
    setEditEndTime(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`);
  };

  const saveDetail = () => {
    if (!detailSale) return;
    // Combine date with start time
    const [h, m] = editStartTime.split(":").map(Number);
    const combinedDate = new Date(editDate);
    combinedDate.setHours(h, m, 0, 0);

    updateSale(detailSale.id, {
      notes: editNotes.trim(),
      clientName: editClient.trim(),
      product: editProduct,
      closer: editCloser,
      sdr: editSdr,
      leadSource: editLeadSource,
      date: combinedDate,
    });
    toast.success("Informações atualizadas!");
    setDetailSale(null);
  };

  const moveSale = moveDialog ? sales.find((s) => s.id === moveDialog.saleId) : null;
  const followUpSale = followUpDialog ? sales.find((s) => s.id === followUpDialog.saleId) : null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-10">
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
          {!isViewer && (
            <Button onClick={() => setAddOpen(true)} size="sm" className="font-semibold">
              <Plus className="h-4 w-4 mr-1" />
              Novo Agendamento
            </Button>
          )}
        </div>


        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por lead..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={sdrFilter} onValueChange={setSdrFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="SDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos SDRs</SelectItem>
              {sdrs.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Closers</SelectItem>
              {closers.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Pagamentos</SelectItem>
              {PAYMENT_METHODS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
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
                      draggable={!isViewer}
                      onDragStart={(e) => !isViewer && handleDragStart(e, sale.id)}
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

      {/* Add Scheduling Dialog */}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Início *</Label>
                <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Fim *</Label>
                <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
              </div>
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

      {/* Move Dialog */}
      <Dialog open={!!moveDialog} onOpenChange={(open) => { if (!open) resetMoveDialog(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

            {movePayment !== "Venda Híbrida" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Valor Bruto (R$)</Label>
                  <Input type="number" placeholder="0,00" value={moveGross} onChange={(e) => setMoveGross(e.target.value)} />
                </div>
                {movePayment === "TMB" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Valor de Entrada</Label>
                    <Input type="number" placeholder="0,00" value={moveDownPayment} onChange={(e) => setMoveDownPayment(e.target.value)} />
                  </div>
                )}
                {moveGross && movePayment && (
                  <div className="text-xs text-muted-foreground bg-secondary rounded-lg p-3">
                    Valor líquido: <span className="font-semibold text-foreground">R$ {calculateNetValue(parseFloat(moveGross) || 0, movePayment).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </>
            )}

            {movePayment === "Venda Híbrida" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Parcelas</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMoveHybridPayments(prev => [...prev, { method: "", value: 0 }])}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {moveHybridPayments.map((hp, idx) => (
                  <div key={idx} className="flex items-end gap-2 p-2 bg-secondary/50 rounded-lg border border-border">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Método</Label>
                      <Select value={hp.method} onValueChange={(v) => setMoveHybridPayments(prev => prev.map((p, i) => i === idx ? { ...p, method: v } : p))}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{NON_HYBRID_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Valor</Label>
                      <Input type="number" placeholder="0" value={hp.value || ""} onChange={(e) => setMoveHybridPayments(prev => prev.map((p, i) => i === idx ? { ...p, value: parseFloat(e.target.value) || 0 } : p))} className="h-8" />
                    </div>
                    {hp.method === "TMB" && (
                      <div className="w-24 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Entrada</Label>
                        <Input type="number" placeholder="0" value={hp.downPayment || ""} onChange={(e) => setMoveHybridPayments(prev => prev.map((p, i) => i === idx ? { ...p, downPayment: parseFloat(e.target.value) || 0 } : p))} className="h-8" />
                      </div>
                    )}
                    {moveHybridPayments.length > 2 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMoveHybridPayments(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="text-xs text-muted-foreground bg-secondary rounded-lg p-3 space-y-1">
                  <div>Total: <span className="font-semibold text-foreground">R$ {moveHybridPayments.reduce((s, p) => s + (p.value || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                  <div>Líquido: <span className="font-semibold text-foreground">R$ {calculateHybridNetValue(moveHybridPayments.filter(p => p.method && p.value > 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                </div>
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
      <Dialog open={!!followUpDialog} onOpenChange={(open) => { if (!open) setFollowUpDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Agendar Follow Up
            </DialogTitle>
            <DialogDescription>
              {followUpSale ? `${followUpSale.clientName} — ${followUpSale.product}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Data do Follow Up</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(followUpDate, "dd MMM yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={followUpDate} onSelect={(d) => d && setFollowUpDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Início</Label>
                <Input type="time" value={followUpStartTime} onChange={(e) => setFollowUpStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Fim</Label>
                <Input type="time" value={followUpEndTime} onChange={(e) => setFollowUpEndTime(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleFollowUpConfirm} className="w-full font-semibold">
              <Save className="h-4 w-4 mr-1" /> Confirmar Follow Up
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail / Edit Dialog */}
      <Dialog open={!!detailSale} onOpenChange={(open) => !open && setDetailSale(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {detailSale && (
            <>
              <DialogHeader>
                <DialogTitle>{isViewer ? "Detalhes do Agendamento" : "Editar Agendamento"}</DialogTitle>
                {!isViewer && <DialogDescription>Altere as informações do agendamento.</DialogDescription>}
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {format(editDate, "dd MMM yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={editDate} onSelect={(d) => d && setEditDate(d)} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Início</Label>
                    <Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Fim</Label>
                    <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Cliente</Label>
                  <Input value={editClient} onChange={(e) => setEditClient(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Produto</Label>
                    <Select value={editProduct} onValueChange={setEditProduct}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Origem</Label>
                    <Select value={editLeadSource} onValueChange={setEditLeadSource}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAD_SOURCES.map((ls) => <SelectItem key={ls} value={ls}>{ls}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Closer</Label>
                    <Select value={editCloser} onValueChange={setEditCloser}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{closers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">SDR</Label>
                    <Select value={editSdr} onValueChange={setEditSdr}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{sdrs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Status</span>
                    <p className="font-semibold text-foreground">{detailSale.status}</p>
                  </div>
                  {detailSale.grossValue > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Valor Bruto</span>
                      <p className="font-semibold text-foreground">R$ {detailSale.grossValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {detailSale.paymentMethod && (
                    <div>
                      <span className="text-muted-foreground text-xs">Pagamento</span>
                      <p className="font-medium text-foreground">{detailSale.paymentMethod}</p>
                    </div>
                  )}
                  {detailSale.netValue > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Valor Líquido</span>
                      <p className="font-medium text-foreground">R$ {detailSale.netValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
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
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {!isViewer && (
                  <div className="flex gap-2">
                    <Button onClick={saveDetail} className="flex-1 font-semibold">
                      <Save className="h-4 w-4 mr-1" /> Salvar Alterações
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(detailSale.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O agendamento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default KanbanBoard;
