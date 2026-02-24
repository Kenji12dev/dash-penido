export const CHART_COLORS = [
  "hsl(230, 80%, 62%)",
  "hsl(270, 70%, 60%)",
  "hsl(195, 80%, 55%)",
  "hsl(152, 60%, 48%)",
  "hsl(340, 70%, 58%)",
  "hsl(30, 85%, 55%)",
  "hsl(10, 75%, 55%)",
  "hsl(180, 60%, 50%)",
  "hsl(260, 50%, 55%)",
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
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Calcula o valor líquido baseado no método de pagamento e valor bruto.
 * Fórmulas:
 * - TMB: bruto * 0.95
 * - Ombrelone: (bruto * 0.94) - 2.49
 * - Hubla: (bruto * 0.94) - 2.49
 * - Zouti: (bruto * 0.96) - 1.49
 * - Pix: bruto (sem taxa)
 * - Kiwify: bruto * 0.91
 * - TMB Antecipado: bruto * 0.80
 * - Infinity Pay: bruto * 1.00
 */
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
    default:
      return 0;
  }
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
};
