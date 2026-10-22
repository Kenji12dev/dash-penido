import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import LeadFunnelChart from "@/components/dashboard/LeadFunnelChart";
import type { Sale } from "@/context/SalesContext";

// O hook le as vendas do contexto; aqui elas vem de um mock.
const salesMock: { current: Sale[] } = { current: [] };
vi.mock("@/context/SalesContext", () => ({
  useSales: () => ({ sales: salesMock.current }),
}));

const { useDashboardMetrics } = await import("@/hooks/useDashboardMetrics");

const lead = (over: Partial<Sale>): Sale => ({
  id: Math.random().toString(36).slice(2),
  date: new Date("2026-09-20T12:00:00Z"),
  createdAt: new Date("2026-09-20T12:00:00Z"),
  clientName: "Lead",
  product: "",
  grossValue: 0,
  netValue: 0,
  paymentMethod: "",
  closer: "",
  sdr: "",
  status: "Aplicação",
  leadSource: "Grupo Penido",
  notes: "",
  externalSubmissionId: "abc",
  ...over,
});

describe("funil das aplicacoes (useDashboardMetrics.leadFunnel)", () => {
  it("conta cada lead no estagio atual e empilha por origem", () => {
    salesMock.current = [
      lead({ status: "Aplicação" }),
      lead({ status: "Ativado", leadSource: "Lista VIP" }),
      lead({ status: "Pendente", closer: "Andre", date: new Date("2026-10-05T12:00:00Z") }), // agendado: date virou a da call
      lead({ status: "Pago", closer: "Andre", leadSource: "Lista VIP" }),
      lead({ status: "Descartado" }),
      // lead lancado a mao (sem formulario): fica fora do funil
      lead({ status: "Pago", closer: "Andre", externalSubmissionId: undefined, createdAt: undefined, leadSource: "Social Selling" }),
    ];
    const { result } = renderHook(() =>
      useDashboardMetrics(new Date("2026-09-01"), new Date("2026-09-30"))
    );
    const f = result.current.leadFunnel;
    expect(f.total).toBe(5);
    const by = Object.fromEntries(f.stages.map((s) => [s.key, s]));
    expect(by.aguardando.count).toBe(1);
    expect(by.ativado.count).toBe(1);
    expect(by.agendado.count).toBe(2); // Pendente + Pago, mesmo com a call em outubro
    expect(by.descartado.count).toBe(1);
    expect(by.agendado.byOrigin).toEqual({ "Grupo Penido": 1, "Lista VIP": 1 });
    expect(f.origins.map((o) => o.name)).toEqual(["Grupo Penido", "Lista VIP"]);
    expect(by.agendado.percentage).toBe(40);
  });

  it("filtra pelo periodo em que a aplicacao chegou, nao pela data da call", () => {
    salesMock.current = [
      lead({ createdAt: new Date("2026-08-15T12:00:00Z") }),
      lead({ createdAt: new Date("2026-09-15T12:00:00Z") }),
    ];
    const { result } = renderHook(() =>
      useDashboardMetrics(new Date("2026-09-01"), new Date("2026-09-30"))
    );
    expect(result.current.leadFunnel.total).toBe(1);
  });

  it("aplicacoes continuam fora das metricas de venda", () => {
    salesMock.current = [lead({ status: "Aplicação" }), lead({ status: "Ativado" })];
    const { result } = renderHook(() =>
      useDashboardMetrics(new Date("2026-09-01"), new Date("2026-09-30"))
    );
    expect(result.current.quantidadeVendas).toBe(0);
    expect(result.current.statusData).toEqual([]);
  });
});

describe("<LeadFunnelChart />", () => {
  it("mostra os numeros por estagio e a legenda com as duas origens", () => {
    render(
      <LeadFunnelChart
        data={{
          total: 7,
          ativacao: { amostra: 2, mediaMin: 90, medianaMin: 90 },
          origins: [
            { name: "Lista VIP", color: "#7953c6" },
            { name: "Grupo Penido", color: "#e25336" },
          ],
          stages: [
            { key: "aguardando", label: "Aguardando", count: 3, percentage: 42.9, byOrigin: { "Grupo Penido": 2, "Lista VIP": 1 } },
            { key: "ativado", label: "Ativados", count: 2, percentage: 28.6, byOrigin: { "Lista VIP": 2 } },
            { key: "agendado", label: "Agendados", count: 1, percentage: 14.3, byOrigin: { "Grupo Penido": 1 } },
            { key: "descartado", label: "Descartados", count: 1, percentage: 14.3, byOrigin: { "Grupo Penido": 1 } },
          ],
        }}
      />
    );
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Ativados")).toBeInTheDocument();
    expect(screen.getByText("28.6%")).toBeInTheDocument();
    expect(screen.getByText("Lista VIP")).toBeInTheDocument();
    expect(screen.getByText("Grupo Penido")).toBeInTheDocument();
  });

  it("tem estado vazio quando nao chegou aplicacao no periodo", () => {
    render(<LeadFunnelChart data={{ total: 0, ativacao: { amostra: 0, mediaMin: null, medianaMin: null }, origins: [], stages: [] }} />);
    expect(screen.getByText("Nenhum lead no período")).toBeInTheDocument();
  });
});
