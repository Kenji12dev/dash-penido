import { useState } from "react";
import { startOfMonth } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import DateFilter from "@/components/dashboard/DateFilter";
import CalendarLinkCard from "@/components/dashboard/CalendarLinkCard";
import KPICard from "@/components/dashboard/KPICard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import TeamPerformance from "@/components/dashboard/TeamPerformance";
import PaymentDistribution from "@/components/dashboard/PaymentDistribution";
import LeadSourceDistribution from "@/components/dashboard/LeadSourceDistribution";
import StatusDistribution from "@/components/dashboard/StatusDistribution";
import CallStatusChart from "@/components/dashboard/CallStatusChart";
import MonthlyGoals from "@/components/dashboard/MonthlyGoals";
import { useDashboardMetrics, DashboardFilters } from "@/hooks/useDashboardMetrics";
import { PAYMENT_METHOD_MAP, LEAD_SOURCE_MAP } from "@/data/mockData";

const formatValue = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Dashboard = () => {
  const { role } = useAuth();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [filters, setFilters] = useState<DashboardFilters>({});

  const metrics = useDashboardMetrics(startDate, endDate, filters);

  const handleCloserClick = (name: string) => {
    setFilters((prev) => ({ ...prev, closer: prev.closer === name || !name ? undefined : name }));
  };
  const handleSdrClick = (name: string) => {
    setFilters((prev) => ({ ...prev, sdr: prev.sdr === name || !name ? undefined : name }));
  };
  const handlePaymentClick = (name: string) => {
    const methodKey = Object.entries(PAYMENT_METHOD_MAP).find(([, v]) => v.label === name)?.[0] || name;
    setFilters((prev) => ({ ...prev, paymentMethod: prev.paymentMethod === methodKey || !name ? undefined : methodKey }));
  };
  const handleLeadSourceClick = (name: string) => {
    const sourceKey = Object.entries(LEAD_SOURCE_MAP).find(([, v]) => v.label === name)?.[0] || name;
    setFilters((prev) => ({ ...prev, leadSource: prev.leadSource === sourceKey || !name ? undefined : sourceKey }));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="max-w-[1440px] mx-auto space-y-8">
        {role === "colaborador" && <CalendarLinkCard />}
        <DateFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        {(filters.closer || filters.sdr || filters.paymentMethod || filters.leadSource) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Filtros ativos:</span>
            {filters.closer && (
              <span className="text-xs bg-primary/15 text-primary px-2 py-1 rounded-md">
                Closer: {filters.closer}
                <button onClick={() => handleCloserClick("")} className="ml-1 hover:text-destructive">×</button>
              </span>
            )}
            {filters.sdr && (
              <span className="text-xs bg-primary/15 text-primary px-2 py-1 rounded-md">
                SDR: {filters.sdr}
                <button onClick={() => handleSdrClick("")} className="ml-1 hover:text-destructive">×</button>
              </span>
            )}
            {filters.paymentMethod && (
              <span className="text-xs bg-primary/15 text-primary px-2 py-1 rounded-md">
                Pagamento: {filters.paymentMethod}
                <button onClick={() => handlePaymentClick("")} className="ml-1 hover:text-destructive">×</button>
              </span>
            )}
            {filters.leadSource && (
              <span className="text-xs bg-primary/15 text-primary px-2 py-1 rounded-md">
                Origem: {filters.leadSource}
                <button onClick={() => handleLeadSourceClick("")} className="ml-1 hover:text-destructive">×</button>
              </span>
            )}
            <button onClick={() => setFilters({})} className="text-xs text-destructive hover:underline ml-2">
              Limpar todos
            </button>
          </div>
        )}

        <MonthlyGoals
          currentRevenue={metrics.faturamentoLiquido}
          currentCash={metrics.caixaGerado}
          isAdmin={role === "admin"}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard label="Faturamento Líquido" value={formatValue(metrics.faturamentoLiquido)} change={0} delay={0} />
          <KPICard label="Caixa Gerado" value={formatValue(metrics.caixaGerado)} change={0} delay={100} />
          <KPICard label="Quantidade de Vendas" value={metrics.quantidadeVendas.toString()} change={0} delay={200} />
          <KPICard label="Ticket Médio" value={formatValue(metrics.ticketMedio)} change={0} delay={300} />
        </div>

        <RevenueChart data={metrics.revenueOverTime} />
        <CallStatusChart
          data={metrics.statusData}
          closers={metrics.closersList}
          salesByCloser={metrics.callStatusByCloser}
        />
        <TeamPerformance
          closerData={metrics.closerData}
          sdrData={metrics.sdrData}
          activeCloser={filters.closer}
          activeSdr={filters.sdr}
          onCloserClick={handleCloserClick}
          onSdrClick={handleSdrClick}
        />
        <PaymentDistribution
          data={metrics.paymentData}
          activePayment={filters.paymentMethod ? (PAYMENT_METHOD_MAP[filters.paymentMethod]?.label || filters.paymentMethod) : undefined}
          onPaymentClick={handlePaymentClick}
        />
        <LeadSourceDistribution
          data={metrics.leadSourceData}
          activeSource={filters.leadSource ? (LEAD_SOURCE_MAP[filters.leadSource]?.label || filters.leadSource) : undefined}
          onSourceClick={handleLeadSourceClick}
        />
      </div>
    </div>
  );
};

export default Dashboard;
