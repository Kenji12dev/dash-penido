import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Save, X, DollarSign, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSales } from "@/context/SalesContext";
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

const paymentMethods = ["Crédito", "PIX", "Boleto", "Outro"];
const statuses = ["Pago", "Pendente", "Cancelado", "Reembolsado"];

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
  const [notes, setNotes] = useState("");

  const calculatedNet = autoCalcNet
    ? (parseFloat(grossValue) || 0) * 0.88
    : parseFloat(netValue) || 0;

  const closerCommission = calculatedNet * 0.1;
  const sdrCommission = calculatedNet * 0.05;
  const netMargin = grossValue ? ((calculatedNet / parseFloat(grossValue)) * 100) : 0;

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
    setNotes("");
  };

  const handleSave = () => {
    if (!clientName || !product || !grossValue || !paymentMethod || !closer || !sdr || !status) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    addSale({
      date,
      clientName: clientName.trim(),
      product,
      grossValue: parseFloat(grossValue),
      netValue: calculatedNet,
      paymentMethod,
      closer,
      sdr,
      status,
      notes: notes.trim(),
    });

    toast.success("Venda salva com sucesso!");
    resetForm();
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 glass-card gradient-border p-8 animate-fade-in">
            <h2 className="text-lg font-bold text-foreground mb-6 tracking-tight">
              Nova Venda
            </h2>

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

              {/* Valor Bruto */}
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

              {/* Valor Líquido */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Valor Líquido
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Auto (12% taxas)</span>
                    <Switch checked={autoCalcNet} onCheckedChange={setAutoCalcNet} />
                  </div>
                </div>
                {autoCalcNet ? (
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

              {/* Método de Pagamento */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Método de Pagamento
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {paymentMethods.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    R$ {(parseFloat(grossValue) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Líquido</span>
                  <span className="font-semibold text-foreground">
                    R$ {calculatedNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margem Líquida</span>
                  <span className={cn("font-semibold", netMargin > 80 ? "text-success" : "text-foreground")}>
                    {netMargin.toFixed(1)}%
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
                  <span className="text-muted-foreground">Closer (10%)</span>
                  <span className="font-semibold text-foreground">
                    R$ {closerCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SDR (5%)</span>
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
                {status && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={cn(
                      "font-medium",
                      status === "Pago" && "text-success",
                      status === "Pendente" && "text-warning",
                      status === "Cancelado" && "text-destructive",
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
