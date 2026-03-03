import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Save, X, DollarSign, Users, TrendingUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSales } from "@/context/SalesContext";

import { PAYMENT_METHODS, LEAD_SOURCES, calculateNetValue, getFeeDescription, getCloserCommissionRate, SDR_COMMISSION_RATE, HybridPayment, calculateHybridNetValue, calculateHybridCaixa } from "@/data/mockData";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
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
import { toast } from "sonner";

const statuses = ["Pago", "Pendente", "Follow Up", "Loss", "Reembolsado"];
const NON_HYBRID_METHODS = PAYMENT_METHODS.filter(m => m !== "Venda Híbrida");

const AddSale = () => {
  const { addSale, products, closers, sdrs } = useSales();

  const [date, setDate] = useState<Date>(new Date());
  const [clientName, setClientName] = useState("");
  const [product, setProduct] = useState("");
  const [grossValue, setGrossValue] = useState("");
  const [netValue, setNetValue] = useState("");
  const [autoCalcNet, setAutoCalcNet] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [closer, setCloser] = useState("");
  const [sdr, setSdr] = useState("");
  const [status, setStatus] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [notes, setNotes] = useState("");

  // Hybrid payments
  const [hybridPayments, setHybridPayments] = useState<HybridPayment[]>([
    { method: "", value: 0 },
    { method: "", value: 0 },
  ]);

  const isHybrid = paymentMethod === "Venda Híbrida";
  const gross = parseFloat(grossValue) || 0;

  const calculatedNet = autoCalcNet
    ? isHybrid
      ? calculateHybridNetValue(hybridPayments.filter(p => p.method && p.value > 0))
      : (paymentMethod ? calculateNetValue(gross, paymentMethod) : 0)
    : parseFloat(netValue) || 0;

  const hybridHasTMB = isHybrid && hybridPayments.some(p => p.method === "TMB");

  const closerRate = closer ? getCloserCommissionRate(closer) : 0;
  const closerCommission = calculatedNet * closerRate;
  const sdrCommission = calculatedNet * SDR_COMMISSION_RATE;
  const netMargin = grossValue ? ((calculatedNet / parseFloat(grossValue)) * 100) : 0;

  const addHybridRow = () => {
    setHybridPayments(prev => [...prev, { method: "", value: 0 }]);
  };

  const removeHybridRow = (index: number) => {
    if (hybridPayments.length <= 2) return;
    setHybridPayments(prev => prev.filter((_, i) => i !== index));
  };

  const updateHybridRow = (index: number, field: keyof HybridPayment, val: any) => {
    setHybridPayments(prev => prev.map((p, i) => i === index ? { ...p, [field]: val } : p));
  };

  // Auto-calc gross from hybrid sum
  const hybridTotal = hybridPayments.reduce((sum, p) => sum + (p.value || 0), 0);

  const resetForm = () => {
    setDate(new Date());
    setClientName("");
    setProduct("");
    setGrossValue("");
    setNetValue("");
    setPaymentMethod("");
    setCloser("");
    setSdr("");
    setStatus("");
    setLeadSource("");
    setDownPayment("");
    setNotes("");
    setHybridPayments([{ method: "", value: 0 }, { method: "", value: 0 }]);
  };

  const handleSave = async () => {
    if (!clientName || !product || !paymentMethod || !closer || !sdr || !status || !leadSource) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    if (isHybrid) {
      const validPayments = hybridPayments.filter(p => p.method && p.value > 0);
      if (validPayments.length < 2) {
        toast.error("Venda Híbrida precisa de pelo menos 2 métodos de pagamento.");
        return;
      }

      const createdSale = await addSale({
        date,
        clientName: clientName.trim(),
        product,
        grossValue: hybridTotal,
        netValue: calculateHybridNetValue(validPayments),
        paymentMethod: "Venda Híbrida",
        closer,
        sdr,
        status,
        leadSource,
        downPayment: hybridHasTMB && downPayment ? parseFloat(downPayment) : undefined,
        notes: notes.trim(),
        hybridPayments: validPayments,
      });

      if (!createdSale) return;
    } else {
      if (!grossValue) {
        toast.error("Preencha o valor bruto.");
        return;
      }
      const createdSale = await addSale({
        date,
        clientName: clientName.trim(),
        product,
        grossValue: parseFloat(grossValue),
        netValue: calculatedNet,
        paymentMethod,
        closer,
        sdr,
        status,
        leadSource,
        downPayment: paymentMethod === "TMB" && downPayment ? parseFloat(downPayment) : undefined,
        notes: notes.trim(),
      });

      if (!createdSale) return;
    }

    toast.success("Venda salva com sucesso!");
    resetForm();
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 glass-card gradient-border p-5 sm:p-8 animate-fade-in">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Nova Venda
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Data da Venda */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Data da Venda
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary border-border",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {date ? format(date, "dd MMM yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Cliente */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Nome do Cliente
                </Label>
                <Input
                  placeholder="Nome completo"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="bg-secondary border-border"
                  maxLength={200}
                />
              </div>

              {/* Produto */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Produto
                </Label>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {products.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Método de Pagamento */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Método de Pagamento
                </Label>
                <Select value={paymentMethod} onValueChange={(v) => {
                  setPaymentMethod(v);
                  if (v !== "TMB" && v !== "Venda Híbrida") setDownPayment("");
                }}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m} <span className="text-muted-foreground ml-1">({getFeeDescription(m)})</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Non-hybrid: Valor Bruto */}
              {!isHybrid && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Valor da Venda (Bruto)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={grossValue}
                      onChange={(e) => setGrossValue(e.target.value)}
                      className="bg-secondary border-border pl-10"
                    />
                  </div>
                </div>
              )}

              {/* TMB: Valor de Entrada */}
              {paymentMethod === "TMB" && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Valor de Entrada (1ª parcela)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value)}
                      className="bg-secondary border-border pl-10"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Valor que entra no caixa (boleto)</p>
                </div>
              )}

              {/* Hybrid Payments Section */}
              {isHybrid && (
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Parcelas da Venda Híbrida
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={addHybridRow}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {hybridPayments.map((hp, idx) => (
                      <div key={idx} className="flex items-end gap-3 p-3 bg-secondary/50 rounded-lg border border-border">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Método</Label>
                          <Select value={hp.method} onValueChange={(v) => updateHybridRow(idx, "method", v)}>
                            <SelectTrigger className="bg-secondary border-border h-9">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border z-50">
                              {NON_HYBRID_METHODS.map((m) => (
                                <SelectItem key={m} value={m}>{m} <span className="text-muted-foreground ml-1">({getFeeDescription(m)})</span></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32 space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0,00"
                            value={hp.value || ""}
                            onChange={(e) => updateHybridRow(idx, "value", parseFloat(e.target.value) || 0)}
                            className="bg-secondary border-border h-9"
                          />
                        </div>
                        {hp.method === "TMB" && (
                          <div className="w-32 space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Entrada</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0,00"
                              value={hp.downPayment || ""}
                              onChange={(e) => updateHybridRow(idx, "downPayment", parseFloat(e.target.value) || 0)}
                              className="bg-secondary border-border h-9"
                            />
                          </div>
                        )}
                        <div className="w-24 text-right">
                          <span className="text-xs text-muted-foreground">
                            Líq: R$ {hp.method && hp.value ? calculateNetValue(hp.value, hp.method).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
                          </span>
                        </div>
                        {hybridPayments.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeHybridRow(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3 border border-border">
                    <span className="text-xs text-muted-foreground">Total Bruto:</span>
                    <span className="text-sm font-semibold text-foreground">R$ {hybridTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3 border border-border">
                    <span className="text-xs text-muted-foreground">Caixa Gerado (sem TMB):</span>
                    <span className="text-sm font-semibold text-foreground">R$ {calculateHybridCaixa(hybridPayments.filter(p => p.method && p.value > 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Closer */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Closer Responsável
                </Label>
                <Select value={closer} onValueChange={setCloser}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {closers.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Valor Líquido */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Valor Líquido
                  </Label>
                  {!isHybrid && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {paymentMethod ? `Auto (${getFeeDescription(paymentMethod)})` : "Auto — selecione o pagamento"}
                      </span>
                      <Switch checked={autoCalcNet} onCheckedChange={setAutoCalcNet} />
                    </div>
                  )}
                </div>
                {autoCalcNet || isHybrid ? (
                  <div className="h-10 flex items-center px-3 rounded-md bg-secondary border border-border text-sm text-foreground">
                    R$ {calculatedNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={netValue}
                      onChange={(e) => setNetValue(e.target.value)}
                      className="bg-secondary border-border pl-10"
                    />
                  </div>
                )}
              </div>

              {/* SDR */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  SDR Responsável
                </Label>
                <Select value={sdr} onValueChange={setSdr}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {sdrs.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Status da Venda
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Origem do Lead */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Origem do Lead
                </Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {LEAD_SOURCES.map((ls) => (
                      <SelectItem key={ls} value={ls}>{ls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Observações */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Observações (opcional)
                </Label>
                <Textarea
                  placeholder="Notas adicionais sobre a venda..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-secondary border-border resize-none"
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 mt-8">
              <Button
                onClick={handleSave}
                className="font-bold text-primary-foreground px-8 h-11 rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Venda
              </Button>
              <Button variant="ghost" onClick={resetForm} className="text-muted-foreground">
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>

          {/* Summary Preview */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <div className="glass-card gradient-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resumo da Venda
                </h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bruto</span>
                  <span className="font-semibold text-foreground">
                    R$ {(isHybrid ? hybridTotal : (parseFloat(grossValue) || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Líquido</span>
                  <span className="font-semibold text-foreground">
                    R$ {calculatedNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {paymentMethod === "TMB" && downPayment && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrada (Caixa)</span>
                  <span className="font-semibold text-foreground">
                    R$ {(parseFloat(downPayment) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                )}
                {isHybrid && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Caixa (sem TMB)</span>
                  <span className="font-semibold text-foreground">
                    R$ {calculateHybridCaixa(hybridPayments.filter(p => p.method && p.value > 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                )}
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margem Líquida</span>
                  <span className={cn("font-semibold", netMargin > 80 ? "text-success" : "text-foreground")}>
                    {isHybrid && hybridTotal > 0
                      ? ((calculatedNet / hybridTotal) * 100).toFixed(1)
                      : netMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card gradient-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Comissões
                </h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {closer ? `${closer} (${(closerRate * 100).toFixed(0)}%)` : "Closer"}
                  </span>
                  <span className="font-semibold text-foreground">
                    R$ {closerCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {sdr ? `${sdr} (${(SDR_COMMISSION_RATE * 100).toFixed(0)}%)` : "SDR (3%)"}
                  </span>
                  <span className="font-semibold text-foreground">
                    R$ {sdrCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card gradient-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-success" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Detalhes
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                {closer && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closer</span>
                    <span className="text-foreground">{closer}</span>
                  </div>
                )}
                {sdr && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SDR</span>
                    <span className="text-foreground">{sdr}</span>
                  </div>
                )}
                {paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pagamento</span>
                    <span className="text-foreground">{paymentMethod}</span>
                  </div>
                )}
                {isHybrid && hybridPayments.filter(p => p.method).map((hp, i) => (
                  <div key={i} className="flex justify-between pl-4">
                    <span className="text-muted-foreground text-xs">{hp.method}</span>
                    <span className="text-foreground text-xs">R$ {(hp.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {status && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={cn(
                      "font-medium",
                      status === "Pago" && "text-success",
                      status === "Pendente" && "text-warning",
                      status === "Follow Up" && "text-blue-500",
                      status === "Loss" && "text-destructive",
                      status === "Reembolsado" && "text-muted-foreground"
                    )}>
                      {status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSale;
