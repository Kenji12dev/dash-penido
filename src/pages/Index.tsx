import { BarChart3 } from "lucide-react";
import DateFilter from "@/components/dashboard/DateFilter";
import KPICard from "@/components/dashboard/KPICard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import TeamPerformance from "@/components/dashboard/TeamPerformance";
import PaymentDistribution from "@/components/dashboard/PaymentDistribution";
import { kpiData } from "@/data/mockData";

const formatCurrency = (v: number) =>
  `R$ ${(v / 1000).toFixed(0)}k`;

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-[1440px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Sales Performance
              </h1>
              <p className="text-xs text-muted-foreground">
                Painel de controle executivo
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <DateFilter />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard
            label="Faturamento Líquido"
            value={`R$ ${(kpiData.faturamentoLiquido.value / 1000000).toFixed(2)}M`}
            change={kpiData.faturamentoLiquido.change}
            delay={0}
          />
          <KPICard
            label="Caixa Gerado"
            value={`R$ ${(kpiData.caixaGerado.value / 1000000).toFixed(2)}M`}
            change={kpiData.caixaGerado.change}
            delay={100}
          />
          <KPICard
            label="Quantidade de Vendas"
            value={kpiData.quantidadeVendas.value.toString()}
            change={kpiData.quantidadeVendas.change}
            delay={200}
          />
          <KPICard
            label="Ticket Médio"
            value={`R$ ${kpiData.ticketMedio.value.toLocaleString("pt-BR")}`}
            change={kpiData.ticketMedio.change}
            delay={300}
          />
        </div>

        {/* Revenue Chart */}
        <RevenueChart />

        {/* Team Performance */}
        <TeamPerformance />

        {/* Payment Distribution */}
        <PaymentDistribution />
      </div>
    </div>
  );
};

export default Index;
