import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useSales } from "@/context/SalesContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { MessageSquare, Reply, Phone, Save, CalendarDays } from "lucide-react";

interface SdrMetric {
  id: string;
  user_id: string;
  collaborator_id: string;
  date: string;
  conversations_started: number;
  first_replies: number;
  calls_scheduled: number;
}

interface Collaborator {
  id: string;
  name: string;
  type: string;
  user_id: string | null;
}

const PreSales = () => {
  const { user, role } = useAuth();
  const { sales } = useSales();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [myCollaborator, setMyCollaborator] = useState<Collaborator | null>(null);
  const [allMetrics, setAllMetrics] = useState<SdrMetric[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [conversationsStarted, setConversationsStarted] = useState(0);
  const [firstReplies, setFirstReplies] = useState(0);
  const [callsScheduled, setCallsScheduled] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Fetch SDR collaborators
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("collaborators")
        .select("*")
        .eq("type", "sdr")
        .order("name");
      if (data) {
        setCollaborators(data);
        const mine = data.find((c) => c.user_id === user?.id);
        setMyCollaborator(mine || null);
      }
    };
    fetch();
  }, [user]);

  // Fetch all metrics for the selected month
  useEffect(() => {
    const fetchMetrics = async () => {
      const start = format(startOfMonth(new Date(selectedYear, selectedMonth)), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(selectedYear, selectedMonth)), "yyyy-MM-dd");
      const { data } = await supabase
        .from("sdr_daily_metrics")
        .select("*")
        .gte("date", start)
        .lte("date", end);
      if (data) setAllMetrics(data as SdrMetric[]);
    };
    fetchMetrics();
  }, [selectedMonth, selectedYear]);

  // Load existing data for selected date
  useEffect(() => {
    if (!myCollaborator) return;
    const existing = allMetrics.find(
      (m) => m.collaborator_id === myCollaborator.id && m.date === selectedDate
    );
    if (existing) {
      setConversationsStarted(existing.conversations_started);
      setFirstReplies(existing.first_replies);
      setCallsScheduled(existing.calls_scheduled);
    } else {
      setConversationsStarted(0);
      setFirstReplies(0);
      setCallsScheduled(0);
    }
  }, [selectedDate, myCollaborator, allMetrics]);

  const handleSave = async () => {
    if (!myCollaborator || !user) {
      toast.error("Você precisa estar vinculado como SDR para registrar dados");
      return;
    }
    setSaving(true);

    const existing = allMetrics.find(
      (m) => m.collaborator_id === myCollaborator.id && m.date === selectedDate
    );

    if (existing) {
      const { error } = await supabase
        .from("sdr_daily_metrics")
        .update({
          conversations_started: conversationsStarted,
          first_replies: firstReplies,
          calls_scheduled: callsScheduled,
        })
        .eq("id", existing.id);
      if (error) {
        toast.error("Erro ao atualizar: " + error.message);
      } else {
        toast.success("Dados atualizados!");
        setAllMetrics((prev) =>
          prev.map((m) =>
            m.id === existing.id
              ? { ...m, conversations_started: conversationsStarted, first_replies: firstReplies, calls_scheduled: callsScheduled }
              : m
          )
        );
      }
    } else {
      const { data, error } = await supabase
        .from("sdr_daily_metrics")
        .insert({
          user_id: user.id,
          collaborator_id: myCollaborator.id,
          date: selectedDate,
          conversations_started: conversationsStarted,
          first_replies: firstReplies,
          calls_scheduled: callsScheduled,
        } as any)
        .select()
        .single();
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
      } else {
        toast.success("Dados salvos!");
        if (data) setAllMetrics((prev) => [...prev, data as SdrMetric]);
      }
    }
    setSaving(false);
  };

  // Build comparison chart data: appointments from sales (Kanban integration)
  const appointmentChartData = useMemo(() => {
    const start = startOfMonth(new Date(selectedYear, selectedMonth));
    const end = endOfMonth(new Date(selectedYear, selectedMonth));
    const sdrNames = collaborators.map((c) => c.name);

    // Count sales (appointments) per SDR for the selected month
    const monthlySales = sales.filter((s) => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });

    const sdrCounts: Record<string, { total: number; pago: number; pendente: number; followUp: number; loss: number }> = {};
    sdrNames.forEach((name) => {
      sdrCounts[name] = { total: 0, pago: 0, pendente: 0, followUp: 0, loss: 0 };
    });

    monthlySales.forEach((sale) => {
      if (sdrCounts[sale.sdr]) {
        sdrCounts[sale.sdr].total++;
        const status = sale.status.toLowerCase();
        if (status === "pago") sdrCounts[sale.sdr].pago++;
        else if (status === "pendente") sdrCounts[sale.sdr].pendente++;
        else if (status === "follow up") sdrCounts[sale.sdr].followUp++;
        else if (status === "loss") sdrCounts[sale.sdr].loss++;
      }
    });

    return sdrNames.map((name) => ({
      name,
      Total: sdrCounts[name]?.total || 0,
      Pago: sdrCounts[name]?.pago || 0,
      Pendente: sdrCounts[name]?.pendente || 0,
      "Follow Up": sdrCounts[name]?.followUp || 0,
      Loss: sdrCounts[name]?.loss || 0,
    }));
  }, [sales, collaborators, selectedMonth, selectedYear]);

  // Build SDR metrics comparison chart
  const metricsChartData = useMemo(() => {
    const sdrNames = collaborators.map((c) => c.name);
    const sdrMap = Object.fromEntries(collaborators.map((c) => [c.id, c.name]));

    const totals: Record<string, { conversations: number; replies: number; calls: number }> = {};
    sdrNames.forEach((name) => {
      totals[name] = { conversations: 0, replies: 0, calls: 0 };
    });

    allMetrics.forEach((m) => {
      const name = sdrMap[m.collaborator_id];
      if (name && totals[name]) {
        totals[name].conversations += m.conversations_started;
        totals[name].replies += m.first_replies;
        totals[name].calls += m.calls_scheduled;
      }
    });

    return sdrNames.map((name) => ({
      name,
      "Conversas Iniciadas": totals[name]?.conversations || 0,
      "Respostas": totals[name]?.replies || 0,
      "Calls Marcadas": totals[name]?.calls || 0,
    }));
  }, [allMetrics, collaborators]);

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
  }));

  const isSDR = myCollaborator !== null;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Pré-vendas</h1>
        <div className="flex items-center gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SDR Daily Input */}
      {isSDR && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Registrar Dados do Dia — {myCollaborator.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  Conversas Iniciadas
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={conversationsStarted}
                  onChange={(e) => setConversationsStarted(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                  Respostas à 1ª Mensagem
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={firstReplies}
                  onChange={(e) => setFirstReplies(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Calls Marcadas
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={callsScheduled}
                  onChange={(e) => setCallsScheduled(Number(e.target.value))}
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="mt-4">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isSDR && role === "admin" && (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-sm">
              Como administrador, você pode visualizar os dados de todos os SDRs abaixo. Apenas SDRs podem registrar seus próprios dados diários.
            </p>
          </CardContent>
        </Card>
      )}

      {/* SDR Metrics Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Métricas de Pré-venda — {months[selectedMonth].label.charAt(0).toUpperCase() + months[selectedMonth].label.slice(1)}/{selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {metricsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={metricsChartData} barGap={4} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Bar dataKey="Conversas Iniciadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Respostas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Calls Marcadas" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">Nenhum dado registrado neste mês.</p>
          )}
        </CardContent>
      </Card>

      {/* Appointments Comparison Chart (from sales/kanban) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agendamentos por SDR — {months[selectedMonth].label.charAt(0).toUpperCase() + months[selectedMonth].label.slice(1)}/{selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {appointmentChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={appointmentChartData} barGap={4} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pago" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pendente" fill="hsl(48, 96%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Follow Up" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Loss" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">Nenhum agendamento encontrado neste mês.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PreSales;
