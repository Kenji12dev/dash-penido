import { useMemo } from "react";
import { useSales } from "@/context/SalesContext";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PAYMENT_METHOD_MAP, CHART_COLORS } from "@/data/mockData";

export interface DashboardMetrics {
  faturamentoLiquido: number;
  caixaGerado: number;
  quantidadeVendas: number;
  ticketMedio: number;
  revenueOverTime: { date: string; revenue: number }[];
  closerData: { name: string; sales: number; revenue: number; percentage: number }[];
  sdrData: { name: string; sales: number; percentage: number }[];
  paymentData: { name: string; value: number; percentage: number; color: string }[];
}

export const useDashboardMetrics = (startDate: Date, endDate: Date): DashboardMetrics => {
  const { sales } = useSales();

  return useMemo(() => {
    const filteredSales = sales.filter((s) => {
      const saleDate = new Date(s.date);
      return (
        s.status === "Pago" &&
        isWithinInterval(saleDate, {
          start: startOfDay(startDate),
          end: endOfDay(endDate),
        })
      );
    });

    const faturamentoLiquido = filteredSales.reduce((sum, s) => sum + s.netValue, 0);
    const caixaGerado = filteredSales.reduce((sum, s) => sum + s.grossValue, 0);
    const quantidadeVendas = filteredSales.length;
    const ticketMedio = quantidadeVendas > 0 ? faturamentoLiquido / quantidadeVendas : 0;

    // Revenue over time - group by day
    const revenueByDay = new Map<string, number>();
    filteredSales.forEach((s) => {
      const key = format(new Date(s.date), "dd MMM", { locale: ptBR });
      revenueByDay.set(key, (revenueByDay.get(key) || 0) + s.netValue);
    });
    const revenueOverTime = Array.from(revenueByDay.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    // Closer performance
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

    // SDR performance
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

    // Payment distribution
    const paymentMap = new Map<string, number>();
    filteredSales.forEach((s) => {
      paymentMap.set(s.paymentMethod, (paymentMap.get(s.paymentMethod) || 0) + s.netValue);
    });
    const totalPayment = faturamentoLiquido || 1;
    const paymentData = Array.from(paymentMap.entries()).map(([method, value]) => ({
      name: PAYMENT_METHOD_MAP[method]?.label || method,
      value,
      percentage: parseFloat(((value / totalPayment) * 100).toFixed(1)),
      color: PAYMENT_METHOD_MAP[method]?.color || CHART_COLORS[3],
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
    };
  }, [sales, startDate, endDate]);
};
