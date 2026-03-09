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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { MessageSquare, Reply, Phone, Save, CalendarDays, TrendingUp, CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);

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

  // Filter metrics by date range
  const filteredMetrics = useMemo(() => {
    if (!filterStartDate && !filterEndDate) return allMetrics;
    return allMetrics.filter((m) => {
      const d = parseISO(m.date);
      if (filterStartDate && filterEndDate) {
        return isWithinInterval(d, { start: startOfDay(filterStartDate), end: endOfDay(filterEndDate) });
      }
      if (filterStartDate) return d >= startOfDay(filterStartDate);
      if (filterEndDate) return d <= endOfDay(filterEndDate);
      return true;
    });
  }, [allMetrics, filterStartDate, filterEndDate]);

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
    const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
    return sales.filter((s) => {
      const d = new Date(s.date);
      if (d < monthStart || d > monthEnd) return false;
      if (filterStartDate && filterEndDate) {
        return isWithinInterval(d, { start: startOfDay(filterStartDate), end: endOfDay(filterEndDate) });
      }
      if (filterStartDate) return d >= startOfDay(filterStartDate);
      if (filterEndDate) return d <= endOfDay(filterEndDate);
      return true;
    });
  }, [sales, selectedMonth, selectedYear, filterStartDate, filterEndDate]);

  // Build comparison chart data: appointments from sales (Kanban integration)
  const appointmentChartData = useMemo(() => {
    const sdrNames = collaborators.map((c) => c.name);

    const sdrCounts: Record<string, { total: number; pago: number; pendente: number; followUp: number; loss: number }> = {};
    sdrNames.forEach((name) => {
      sdrCounts[name] = { total: 0, pago: 0, pendente: 0, followUp: 0, loss: 0 };
    });

    filteredSales.forEach((sale) => {
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
  }, [filteredSales, collaborators]);

  // Build SDR metrics comparison chart
  const metricsChartData = useMemo(() => {
    const sdrNames = collaborators.map((c) => c.name);
    const sdrMap = Object.fromEntries(collaborators.map((c) => [c.id, c.name]));

    const totals: Record<string, { conversations: number; replies: number; calls: number }> = {};
    sdrNames.forEach((name) => {
      totals[name] = { conversations: 0, replies: 0, calls: 0 };
    });

    filteredMetrics.forEach((m) => {
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
  }, [filteredMetrics, collaborators]);

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
  }));

  const isSDR = myCollaborator !== null;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Pré-vendas</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", filterStartDate && "border-primary text-primary")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {filterStartDate ? format(filterStartDate, "dd/MM", { locale: ptBR }) : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filterStartDate}
                onSelect={setFilterStartDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", filterEndDate && "border-primary text-primary")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {filterEndDate ? format(filterEndDate, "dd/MM", { locale: ptBR }) : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filterEndDate}
                onSelect={setFilterEndDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {(filterStartDate || filterEndDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterStartDate(undefined); setFilterEndDate(undefined); }} className="text-xs gap-1 text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}

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

      {/* SDR Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance dos SDRs — {months[selectedMonth].label.charAt(0).toUpperCase() + months[selectedMonth].label.slice(1)}/{selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SDR</TableHead>
                <TableHead className="text-center">Conversas</TableHead>
                <TableHead className="text-center">Respostas</TableHead>
                <TableHead className="text-center">Calls Marcadas</TableHead>
                <TableHead className="text-center">Taxa Resposta</TableHead>
                <TableHead className="text-center">Taxa Agendamento</TableHead>
                <TableHead className="text-center">Agend. Total</TableHead>
                <TableHead className="text-center">Pagos</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="text-center">Follow Up</TableHead>
                <TableHead className="text-center">Loss</TableHead>
                <TableHead className="text-center">Taxa Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaborators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-10">
                    Nenhum SDR cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                collaborators.map((collab) => {
                  const metrics = metricsChartData.find((m) => m.name === collab.name);
                  const appointments = appointmentChartData.find((a) => a.name === collab.name);
                  const conversations = metrics?.["Conversas Iniciadas"] || 0;
                  const replies = metrics?.["Respostas"] || 0;
                  const calls = metrics?.["Calls Marcadas"] || 0;
                  const total = appointments?.Total || 0;
                  const pago = appointments?.Pago || 0;
                  const pendente = appointments?.Pendente || 0;
                  const followUp = appointments?.["Follow Up"] || 0;
                  const loss = appointments?.Loss || 0;
                  const replyRate = conversations > 0 ? ((replies / conversations) * 100).toFixed(1) : "—";
                  const scheduleRate = replies > 0 ? ((calls / replies) * 100).toFixed(1) : "—";
                  const conversionRate = total > 0 ? ((pago / total) * 100).toFixed(1) : "—";

                  return (
                    <TableRow key={collab.id}>
                      <TableCell className="font-medium">{collab.name}</TableCell>
                      <TableCell className="text-center">{conversations}</TableCell>
                      <TableCell className="text-center">{replies}</TableCell>
                      <TableCell className="text-center">{calls}</TableCell>
                      <TableCell className="text-center">
                        <span className={replyRate !== "—" ? "text-primary font-medium" : "text-muted-foreground"}>
                          {replyRate !== "—" ? `${replyRate}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={scheduleRate !== "—" ? "text-primary font-medium" : "text-muted-foreground"}>
                          {scheduleRate !== "—" ? `${scheduleRate}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-medium">{total}</TableCell>
                      <TableCell className="text-center text-emerald-500 font-medium">{pago}</TableCell>
                      <TableCell className="text-center text-yellow-500 font-medium">{pendente}</TableCell>
                      <TableCell className="text-center text-blue-500 font-medium">{followUp}</TableCell>
                      <TableCell className="text-center text-destructive font-medium">{loss}</TableCell>
                      <TableCell className="text-center">
                        <span className={conversionRate !== "—" ? "text-primary font-semibold" : "text-muted-foreground"}>
                          {conversionRate !== "—" ? `${conversionRate}%` : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PreSales;
