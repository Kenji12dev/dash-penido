import { useState } from "react";
import { subDays } from "date-fns";
import DateFilter from "@/components/dashboard/DateFilter";
import KPICard from "@/components/dashboard/KPICard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import TeamPerformance from "@/components/dashboard/TeamPerformance";
import PaymentDistribution from "@/components/dashboard/PaymentDistribution";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

const formatValue = (v: number) => {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
};

const Dashboard = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const metrics = useDashboardMetrics(startDate, endDate);

  return (
    <div className="p-6 lg:p-10">
      <div className="max-w-[1440px] mx-auto space-y-8">
        <DateFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard label="Faturamento Líquido" value={formatValue(metrics.faturamentoLiquido)} change={0} delay={0} />
          <KPICard label="Caixa Gerado" value={formatValue(metrics.caixaGerado)} change={0} delay={100} />
          <KPICard label="Quantidade de Vendas" value={metrics.quantidadeVendas.toString()} change={0} delay={200} />
          <KPICard label="Ticket Médio" value={formatValue(metrics.ticketMedio)} change={0} delay={300} />
        </div>

        <RevenueChart data={metrics.revenueOverTime} />
        <TeamPerformance closerData={metrics.closerData} sdrData={metrics.sdrData} />
        <PaymentDistribution data={metrics.paymentData} />
      </div>
    </div>
  );
};

export default Dashboard;
