import { useMemo } from "react";
import { useSales } from "@/context/SalesContext";
import { format, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval, min as minDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PAYMENT_METHOD_MAP, LEAD_SOURCE_MAP, CHART_COLORS, STATUS_COLOR_MAP, calculateHybridCaixa, calculateNetValue, LOSS_REASON_COLOR_MAP, isLeadStatus } from "@/data/mockData";

export interface DashboardFilters {
  closer?: string;
  sdr?: string;
  paymentMethod?: string;
  leadSource?: string;
}

export interface DashboardMetrics {
  faturamentoLiquido: number;
  caixaGerado: number;
  quantidadeVendas: number;
  ticketMedio: number;
  revenueOverTime: { date: string; revenue: number }[];
  closerData: { name: string; sales: number; revenue: number; percentage: number }[];
  sdrData: { name: string; sales: number; percentage: number }[];
  paymentData: { name: string; value: number; percentage: number; color: string }[];
  statusData: { name: string; count: number; percentage: number; color: string }[];
  leadSourceData: { name: string; value: number; percentage: number; color: string }[];
  callStatusByCloser: Record<string, { name: string; count: number; color: string }[]>;
  closersList: string[];
  sdrCloserDistribution: Record<string, { closer: string; count: number; percentage: number }[]>;
  lossReasonData: { name: string; count: number; percentage: number; color: string }[];
  leadFunnel: LeadFunnel;
}

/** Em que pe esta cada lead do periodo: aplicacoes do formulario e os lancados a mao. */
export interface LeadFunnel {
  total: number;
  /** Tempo da aplicacao ate a ativacao (minutos), so leads do formulario ja ativados. */
  ativacao: { amostra: number; mediaMin: number | null; medianaMin: number | null };
  origins: { name: string; color: string }[];
  /** Um item por estagio; `byOrigin` e a contagem por origem, para empilhar. */
  stages: { key: string; label: string; count: number; percentage: number; byOrigin: Record<string, number> }[];
}

const LEAD_STAGE_OF: Record<string, string> = {
  "Aplicação": "aguardando",
  Ativado: "ativado",
  Descartado: "descartado",
  // Tudo que passou por agendamento, inclusive o desfecho da call.
  Pendente: "agendado",
  "Follow Up": "agendado",
  "No Show": "agendado",
  Pago: "agendado",
  Loss: "agendado",
  Reembolsado: "agendado",
};
const LEAD_STAGES: { key: string; label: string }[] = [
  { key: "aguardando", label: "Aguardando" },
  { key: "ativado", label: "Ativados" },
  { key: "agendado", label: "Agendados" },
  { key: "descartado", label: "Descartados" },
];

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_COLOR_MAP).map(([k, v]) => [k, v.hsl])
);

export const useDashboardMetrics = (
  startDate: Date,
  endDate: Date,
  filters: DashboardFilters = {}
): DashboardMetrics => {
  const { sales } = useSales();

  return useMemo(() => {
    // Funil das aplicacoes: conta por estagio atual, no periodo em que a
    // aplicacao CHEGOU (created_at), porque `date` vira a data da call quando o
    // lead e agendado e sairia do periodo.
    // So entram os leads vindos de formulario (externalSubmissionId presente).
    const leads = sales.filter((s) => {
      const ref = s.externalSubmissionId ? s.createdAt : undefined;
      if (!ref) return false;
      return isWithinInterval(new Date(ref), { start: startOfDay(startDate), end: endOfDay(endDate) });
    });
    const origemFunil = (s: (typeof sales)[number]) => s.leadSource || "Formulário";
    const originNames = Array.from(new Set(leads.map(origemFunil))).sort();
    const leadFunnel: LeadFunnel = {
      total: leads.length,
      ativacao: (() => {
        const mins = leads
          .filter((s) => s.externalSubmissionId && s.createdAt && s.activatedAt)
          .map((s) => (s.activatedAt!.getTime() - s.createdAt!.getTime()) / 60000)
          .filter((m) => m >= 0)
          .sort((a, b) => a - b);
        if (!mins.length) return { amostra: 0, mediaMin: null, medianaMin: null };
        const mid = Math.floor(mins.length / 2);
        return {
          amostra: mins.length,
          mediaMin: mins.reduce((a, b) => a + b, 0) / mins.length,
          medianaMin: mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2,
        };
      })(),
      origins: originNames.map((name) => ({ name, color: LEAD_SOURCE_MAP[name]?.color || CHART_COLORS[0] })),
      stages: LEAD_STAGES.map(({ key, label }) => {
        const inStage = leads.filter((s) => (LEAD_STAGE_OF[s.status] || "aguardando") === key);
        const byOrigin: Record<string, number> = {};
        inStage.forEach((s) => {
          const o = origemFunil(s);
          byOrigin[o] = (byOrigin[o] || 0) + 1;
        });
        return {
          key,
          label,
          count: inStage.length,
          percentage: leads.length ? parseFloat(((inStage.length / leads.length) * 100).toFixed(1)) : 0,
          byOrigin,
        };
      }),
    };

    // Date-filtered sales (all statuses for status chart).
    // Aplicacoes do formulario ficam de fora de tudo aqui: sao leads que ainda nao
    // viraram call, entao contariam como calls no grafico de status e
    // apareceriam como um closer/SDR vazio na distribuicao.
    const dateFiltered = sales.filter((s) => {
      if (isLeadStatus(s.status)) return false;
      // Aplicacao descartada sem nunca ter sido agendada: nao e call, e um
      // closer vazio viraria uma chave "" nos graficos por closer.
      if (!s.closer) return false;
      const saleDate = new Date(s.date);
      return isWithinInterval(saleDate, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });
    });

    // Apply interactive filters
    const applyFilters = (list: typeof sales) =>
      list.filter((s) => {
        if (filters.closer && s.closer !== filters.closer) return false;
        if (filters.sdr && s.sdr !== filters.sdr) return false;
        if (filters.paymentMethod) {
          if (s.paymentMethod === "Venda Híbrida" && Array.isArray(s.hybridPayments)) {
            const hasMethod = s.hybridPayments.some((hp: any) => hp.method === filters.paymentMethod);
            if (!hasMethod) return false;
          } else if (s.paymentMethod !== filters.paymentMethod) {
            return false;
          }
        }
        if (filters.leadSource && s.leadSource !== filters.leadSource) return false;
        return true;
      });

    // Status distribution — exclude "Pendente" (agendamentos) from call status chart
    const statusFiltered = applyFilters(dateFiltered).filter((s) => s.status !== "Pendente");
    const statusMap = new Map<string, number>();
    statusFiltered.forEach((s) => {
      statusMap.set(s.status, (statusMap.get(s.status) || 0) + 1);
    });
    const totalStatusCount = statusFiltered.length || 1;
    const statusData = Array.from(statusMap.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: parseFloat(((count / totalStatusCount) * 100).toFixed(1)),
      color: STATUS_COLORS[name] || CHART_COLORS[0],
    }));

    // KPIs only count "Pago" sales
    const filteredSales = applyFilters(dateFiltered).filter((s) => s.status === "Pago");

    // Helper: for hybrid sales filtered by payment method, only count the matching portions
    const getNetValueForSale = (s: typeof filteredSales[0]) => {
      if (filters.paymentMethod && s.paymentMethod === "Venda Híbrida" && Array.isArray(s.hybridPayments)) {
        return s.hybridPayments
          .filter((hp: any) => hp.method === filters.paymentMethod)
          .reduce((acc: number, hp: any) => acc + calculateNetValue(hp.value, hp.method), 0);
      }
      return s.netValue;
    };

    const faturamentoLiquido = filteredSales.reduce((sum, s) => sum + getNetValueForSale(s), 0);
    const caixaGerado = filteredSales.reduce((sum, s) => {
      if (s.paymentMethod === "Venda Híbrida" && Array.isArray(s.hybridPayments)) {
        const payments = filters.paymentMethod
          ? s.hybridPayments.filter((hp: any) => hp.method === filters.paymentMethod)
          : s.hybridPayments;
        return sum + calculateHybridCaixa(payments);
      }
      if (s.paymentMethod === "TMB" && s.downPayment != null) {
        return sum + s.downPayment;
      }
      return sum + s.grossValue;
    }, 0);
    const quantidadeVendas = filteredSales.length;
    const ticketMedio = quantidadeVendas > 0 ? faturamentoLiquido / quantidadeVendas : 0;

    // Um ponto por dia do periodo, em ordem cronologica (1o dia a esquerda),
    // incluindo dias sem venda com zero; o periodo nao passa de hoje.
    const revenueByDay = new Map<string, number>();
    filteredSales.forEach((s) => {
      const key = format(new Date(s.date), "yyyy-MM-dd");
      revenueByDay.set(key, (revenueByDay.get(key) || 0) + s.netValue);
    });
    const ultimoDia = minDate([endOfDay(endDate), endOfDay(new Date())]);
    const dias = startOfDay(startDate) <= ultimoDia
      ? eachDayOfInterval({ start: startOfDay(startDate), end: ultimoDia })
      : [];
    const revenueOverTime = dias.map((d) => ({
      date: format(d, "dd MMM", { locale: ptBR }),
      revenue: revenueByDay.get(format(d, "yyyy-MM-dd")) || 0,
    }));

    const closerMap = new Map<string, { sales: number; revenue: number }>();
    filteredSales.forEach((s) => {
      const prev = closerMap.get(s.closer) || { sales: 0, revenue: 0 };
      closerMap.set(s.closer, { sales: prev.sales + 1, revenue: prev.revenue + s.netValue });
    });
    const totalCloserRevenue = faturamentoLiquido || 1;
    const closerData = Array.from(closerMap.entries())
      .map(([name, data]) => ({
        name,
        sales: data.sales,
        revenue: data.revenue,
        percentage: parseFloat(((data.revenue / totalCloserRevenue) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const sdrMap = new Map<string, number>();
    filteredSales.forEach((s) => {
      sdrMap.set(s.sdr, (sdrMap.get(s.sdr) || 0) + 1);
    });
    const totalSdrSales = quantidadeVendas || 1;
    const sdrData = Array.from(sdrMap.entries())
      .map(([name, count]) => ({
        name,
        sales: count,
        percentage: parseFloat(((count / totalSdrSales) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.sales - a.sales);

    const paymentMap = new Map<string, number>();
    filteredSales.forEach((s) => {
      if (s.paymentMethod === "Venda Híbrida" && Array.isArray(s.hybridPayments)) {
        s.hybridPayments.forEach((hp: any) => {
          const method = hp.method || "Outro";
          const net = calculateNetValue(hp.value, method);
          paymentMap.set(method, (paymentMap.get(method) || 0) + net);
        });
      } else {
        paymentMap.set(s.paymentMethod, (paymentMap.get(s.paymentMethod) || 0) + s.netValue);
      }
    });
    const totalPayment = Array.from(paymentMap.values()).reduce((a, b) => a + b, 0) || 1;
    const paymentData = Array.from(paymentMap.entries())
      .filter(([method]) => method && method.trim() !== "")
      .map(([method, value]) => ({
        name: PAYMENT_METHOD_MAP[method]?.label || method,
        value,
        percentage: parseFloat(((value / totalPayment) * 100).toFixed(1)),
        color: PAYMENT_METHOD_MAP[method]?.color || CHART_COLORS[3],
      }));

    // Lead source distribution
    const leadSourceMap = new Map<string, number>();
    filteredSales.forEach((s) => {
      if (s.leadSource) {
        leadSourceMap.set(s.leadSource, (leadSourceMap.get(s.leadSource) || 0) + 1);
      }
    });
    const totalLeadSources = filteredSales.filter((s) => s.leadSource).length || 1;
    const leadSourceData = Array.from(leadSourceMap.entries()).map(([source, count]) => ({
      name: LEAD_SOURCE_MAP[source]?.label || source,
      value: count,
      percentage: parseFloat(((count / totalLeadSources) * 100).toFixed(1)),
      color: LEAD_SOURCE_MAP[source]?.color || CHART_COLORS[0],
    }));

    // Call status grouped by closer
    const closerStatusMap = new Map<string, Map<string, number>>();
    statusFiltered.forEach((s) => {
      if (!closerStatusMap.has(s.closer)) closerStatusMap.set(s.closer, new Map());
      const inner = closerStatusMap.get(s.closer)!;
      inner.set(s.status, (inner.get(s.status) || 0) + 1);
    });
    const callStatusByCloser: Record<string, { name: string; count: number; color: string }[]> = {};
    closerStatusMap.forEach((statusMap, closer) => {
      callStatusByCloser[closer] = Array.from(statusMap.entries()).map(([name, count]) => ({
        name,
        count,
        color: STATUS_COLORS[name] || CHART_COLORS[0],
      }));
    });
    const closersList = Array.from(closerStatusMap.keys()).sort();

    // SDR → Closer distribution (based on all date-filtered sales, not just "Pago")
    const sdrCloserDistribution: Record<string, { closer: string; count: number; percentage: number }[]> = {};
    const allFilteredForDistribution = applyFilters(dateFiltered);
    const sdrNamesSet = new Set(allFilteredForDistribution.map((s) => s.sdr));
    sdrNamesSet.forEach((sdrName) => {
      const sdrSales = allFilteredForDistribution.filter((s) => s.sdr === sdrName);
      const closerCount = new Map<string, number>();
      sdrSales.forEach((s) => {
        closerCount.set(s.closer, (closerCount.get(s.closer) || 0) + 1);
      });
      const total = sdrSales.length || 1;
      sdrCloserDistribution[sdrName] = Array.from(closerCount.entries())
        .map(([closer, count]) => ({
          closer,
          count,
          percentage: parseFloat(((count / total) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.count - a.count);
    });

    // Loss reason distribution (only Loss sales in date range, respecting other filters)
    const lossSales = applyFilters(dateFiltered).filter((s) => s.status === "Loss" && s.lossReason);
    const lossMap = new Map<string, number>();
    lossSales.forEach((s) => {
      const reason = s.lossReason as string;
      lossMap.set(reason, (lossMap.get(reason) || 0) + 1);
    });
    const totalLoss = lossSales.length || 1;
    const lossReasonData = Array.from(lossMap.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: parseFloat(((count / totalLoss) * 100).toFixed(1)),
      color: LOSS_REASON_COLOR_MAP[name] || CHART_COLORS[0],
    }));

    return {
      faturamentoLiquido,
      caixaGerado,
      quantidadeVendas,
      ticketMedio,
      revenueOverTime,
      closerData,
      sdrData,
      paymentData,
      statusData,
      leadSourceData,
      callStatusByCloser,
      closersList,
      sdrCloserDistribution,
      lossReasonData,
      leadFunnel,
    };
  }, [sales, startDate, endDate, filters]);
};
