export const CHART_COLORS = [
  "hsl(190, 90%, 55%)",
  "hsl(168, 75%, 48%)",
  "hsl(215, 85%, 60%)",
  "hsl(145, 65%, 50%)",
  "hsl(270, 70%, 62%)",
  "hsl(45, 93%, 58%)",
  "hsl(330, 75%, 60%)",
  "hsl(20, 85%, 58%)",
  "hsl(200, 30%, 60%)",
];

export const PAYMENT_METHODS = [
  "TMB",
  "Ombrelone",
  "Hubla",
  "Zouti",
  "Pix",
  "Kiwify",
  "TMB Antecipado",
  "Infinity Pay",
  "Hotmart",
  "Boleto Hubla",
  "Venda Híbrida",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CLOSER_COMMISSION_RATES: Record<string, number> = {
  "André Kenji": 0.15,
};

export const CLOSER_COLOR_MAP: Record<string, string> = {
  "André Kenji": CHART_COLORS[0],
};

export const SDR_COMMISSION_RATE = 0.03;

export const getCloserCommissionRate = (closer: string): number => {
  return CLOSER_COMMISSION_RATES[closer] || 0;
};

export const calculateNetValue = (grossValue: number, method: string): number => {
  switch (method) {
    case "TMB":
      return grossValue * 0.95;
    case "Ombrelone":
      return (grossValue * 0.94) - 2.49;
    case "Hubla":
      return (grossValue * 0.94) - 2.49;
    case "Zouti":
      return (grossValue * 0.96) - 1.49;
    case "Pix":
      return grossValue;
    case "Kiwify":
      return grossValue * 0.91;
    case "TMB Antecipado":
      return grossValue * 0.80;
    case "Infinity Pay":
      return grossValue * 1.00;
    case "Hotmart":
      return grossValue * 1.00;
    case "Boleto Hubla":
      return grossValue * 1.00;
    case "Venda Híbrida":
      return grossValue; // calculated per-line
    default:
      return 0;
  }
};

export interface HybridPayment {
  method: string;
  value: number;
  downPayment?: number;
}

export const calculateHybridNetValue = (payments: HybridPayment[]): number => {
  return payments.reduce((sum, p) => sum + calculateNetValue(p.value, p.method), 0);
};

export const calculateHybridCaixa = (payments: HybridPayment[]): number => {
  return payments.reduce((sum, p) => {
    if (p.method === "TMB") return sum; // TMB não conta como caixa em híbrida
    return sum + p.value;
  }, 0);
};

export const getFeeDescription = (method: string): string => {
  switch (method) {
    case "TMB": return "5% taxa";
    case "Ombrelone": return "6% + R$2,49";
    case "Hubla": return "6% + R$2,49";
    case "Zouti": return "4% + R$1,49";
    case "Pix": return "Sem taxa";
    case "Kiwify": return "9% taxa";
    case "TMB Antecipado": return "20% taxa";
    case "Infinity Pay": return "Sem taxa";
    case "Hotmart": return "Sem taxa";
    case "Boleto Hubla": return "Sem taxa";
    case "Venda Híbrida": return "Múltiplos métodos";
    default: return "";
  }
};

export const PAYMENT_METHOD_MAP: Record<string, { label: string; color: string }> = {
  "TMB": { label: "TMB", color: CHART_COLORS[0] },
  "Ombrelone": { label: "Ombrelone", color: CHART_COLORS[1] },
  "Hubla": { label: "Hubla", color: CHART_COLORS[2] },
  "Zouti": { label: "Zouti", color: CHART_COLORS[3] },
  "Pix": { label: "Pix", color: CHART_COLORS[4] },
  "Kiwify": { label: "Kiwify", color: CHART_COLORS[5] },
  "TMB Antecipado": { label: "TMB Antecipado", color: CHART_COLORS[6] },
  "Infinity Pay": { label: "Infinity Pay", color: CHART_COLORS[7] },
  "Hotmart": { label: "Hotmart", color: CHART_COLORS[8] },
  "Boleto Hubla": { label: "Boleto Hubla", color: CHART_COLORS[0] },
  "Venda Híbrida": { label: "Venda Híbrida", color: CHART_COLORS[8] },
};

export const LEAD_SOURCES = [
  "Formulário",
  "Stories do IG",
  "Social Selling",
  "Enquete",
  "Reels",
  "Tráfego",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LOSS_REASONS = [
  "Sem dinheiro",
  "Não sentiu confiança",
  "Kitou no pagamento",
  "Desqualificado",
  "FUP perdido",
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export const LOSS_REASON_COLOR_MAP: Record<string, string> = {
  "Sem dinheiro": CHART_COLORS[0],
  "Não sentiu confiança": CHART_COLORS[1],
  "Kitou no pagamento": CHART_COLORS[2],
  "Desqualificado": CHART_COLORS[3],
  "FUP perdido": CHART_COLORS[4],
};

// Unified status colors used across Kanban, Dashboard charts, and Sales Database
export const STATUS_COLOR_MAP: Record<string, { hsl: string; textClass: string; borderBgClass: string }> = {
  Pendente:    { hsl: "hsl(48, 96%, 53%)",   textClass: "text-yellow-500",  borderBgClass: "border-yellow-500/60 bg-yellow-500/5" },
  Pago:        { hsl: "hsl(152, 69%, 41%)",  textClass: "text-emerald-500", borderBgClass: "border-emerald-500/60 bg-emerald-500/5" },
  Loss:        { hsl: "hsl(0, 84%, 60%)",    textClass: "text-red-500",     borderBgClass: "border-red-500/60 bg-red-500/5" },
  "Follow Up": { hsl: "hsl(217, 91%, 60%)",  textClass: "text-blue-500",    borderBgClass: "border-blue-500/60 bg-blue-500/5" },
  "No Show":   { hsl: "hsl(25, 95%, 53%)",   textClass: "text-orange-500",  borderBgClass: "border-orange-500/60 bg-orange-500/5" },
  Reembolsado: { hsl: "hsl(240, 5%, 65%)",   textClass: "text-zinc-400",    borderBgClass: "border-zinc-500/60 bg-zinc-500/5" },
};

export const LEAD_SOURCE_MAP: Record<string, { label: string; color: string }> = {
  "Formulário": { label: "Formulário", color: CHART_COLORS[0] },
  "Stories do IG": { label: "Stories do IG", color: CHART_COLORS[1] },
  "Social Selling": { label: "Social Selling", color: CHART_COLORS[2] },
  "Enquete": { label: "Enquete", color: CHART_COLORS[3] },
  "Reels": { label: "Reels", color: CHART_COLORS[4] },
  "Tráfego": { label: "Tráfego", color: CHART_COLORS[5] },
};
