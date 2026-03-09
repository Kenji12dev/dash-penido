import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useSales } from "@/context/SalesContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DateFilter from "@/components/dashboard/DateFilter";
import { toast } from "sonner";
import { format, startOfMonth, endOfDay, parseISO, isWithinInterval, startOfDay, getISOWeek, startOfWeek, endOfWeek, addWeeks, getWeeksInMonth, startOfISOWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { MessageSquare, Reply, Phone, Save, CalendarDays, TrendingUp, Pencil, Target } from "lucide-react";

interface SdrMetric {
  id: string;
  user_id: string;
  collaborator_id: string;
  date: string;
  conversations_started: number;
  first_replies: number;
  calls_scheduled: number;
}

interface SdrGoal {
  id: string;
  collaborator_id: string;
  month: number;
  year: number;
  week_number: number;
  conversations_goal: number;
  replies_goal: number;
  calls_goal: number;
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
  const [sdrGoals, setSdrGoals] = useState<SdrGoal[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [conversationsStarted, setConversationsStarted] = useState(0);
  const [firstReplies, setFirstReplies] = useState(0);
  const [callsScheduled, setCallsScheduled] = useState(0);
  const [saving, setSaving] = useState(false);
  const [filterStart, setFilterStart] = useState<Date>(startOfMonth(new Date()));
  const [filterEnd, setFilterEnd] = useState<Date>(endOfDay(new Date()));
  const [goalsDialogOpen, setGoalsDialogOpen] = useState(false);
  const [editingGoals, setEditingGoals] = useState<Record<string, { conversations: number; replies: number; calls: number }>>({});
  const [savingGoals, setSavingGoals] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(getISOWeek(new Date()));

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

  // Fetch metrics based on filter dates
  useEffect(() => {
    const fetchMetrics = async () => {
      const start = format(filterStart, "yyyy-MM-dd");
      const end = format(filterEnd, "yyyy-MM-dd");
      const { data } = await supabase
        .from("sdr_daily_metrics")
        .select("*")
        .gte("date", start)
        .lte("date", end);
      if (data) setAllMetrics(data as SdrMetric[]);
    };
    fetchMetrics();
  }, [filterStart, filterEnd]);

  // Compute available weeks for the filtered month
  const availableWeeks = useMemo(() => {
    const month = filterStart.getMonth();
    const year = filterStart.getFullYear();
    const weeks: { weekNum: number; label: string }[] = [];
    let d = startOfMonth(new Date(year, month));
    const seen = new Set<number>();
    while (d.getMonth() === month) {
      const wn = getISOWeek(d);
      if (!seen.has(wn)) {
        seen.add(wn);
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        const we = endOfWeek(d, { weekStartsOn: 1 });
        weeks.push({ weekNum: wn, label: `Sem ${wn} (${format(ws, "dd/MM")} - ${format(we, "dd/MM")})` });
      }
      d = addWeeks(startOfWeek(d, { weekStartsOn: 1 }), 1);
    }
    return weeks;
  }, [filterStart]);

  // Reset selected week when month changes
  useEffect(() => {
    if (availableWeeks.length > 0 && !availableWeeks.find(w => w.weekNum === selectedWeek)) {
      setSelectedWeek(availableWeeks[0].weekNum);
    }
  }, [availableWeeks]);

  // Fetch SDR goals for current month (all weeks)
  useEffect(() => {
    const fetchGoals = async () => {
      const month = filterStart.getMonth() + 1;
      const year = filterStart.getFullYear();
      const { data } = await supabase
        .from("sdr_goals")
        .select("*")
        .eq("month", month)
        .eq("year", year);
      if (data) setSdrGoals(data as SdrGoal[]);
    };
    fetchGoals();
  }, [filterStart]);

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

  const openGoalsDialog = () => {
    const month = filterStart.getMonth() + 1;
    const year = filterStart.getFullYear();
    const initial: Record<string, { conversations: number; replies: number; calls: number }> = {};
    collaborators.forEach((c) => {
      const goal = sdrGoals.find((g) => g.collaborator_id === c.id && g.month === month && g.year === year && g.week_number === selectedWeek);
      initial[c.id] = {
        conversations: goal?.conversations_goal || 0,
        replies: goal?.replies_goal || 0,
        calls: goal?.calls_goal || 0,
      };
    });
    setEditingGoals(initial);
    setGoalsDialogOpen(true);
  };

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    const month = filterStart.getMonth() + 1;
    const year = filterStart.getFullYear();

    for (const collab of collaborators) {
      const vals = editingGoals[collab.id];
      if (!vals) continue;
      const existing = sdrGoals.find((g) => g.collaborator_id === collab.id && g.month === month && g.year === year && g.week_number === selectedWeek);

      if (existing) {
        await supabase
          .from("sdr_goals")
          .update({
            conversations_goal: vals.conversations,
            replies_goal: vals.replies,
            calls_goal: vals.calls,
          } as any)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("sdr_goals")
          .insert({
            collaborator_id: collab.id,
            month,
            year,
            week_number: selectedWeek,
            conversations_goal: vals.conversations,
            replies_goal: vals.replies,
            calls_goal: vals.calls,
          } as any);
      }
    }

    // Refetch
    const { data } = await supabase.from("sdr_goals").select("*").eq("month", month).eq("year", year);
    if (data) setSdrGoals(data as SdrGoal[]);
    setSavingGoals(false);
    setGoalsDialogOpen(false);
    toast.success("Metas salvas!");
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.date);
      return isWithinInterval(d, { start: startOfDay(filterStart), end: endOfDay(filterEnd) });
    });
  }, [sales, filterStart, filterEnd]);

  // Build comparison chart data
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

  const filterLabel = `${format(filterStart, "dd/MM/yy")} — ${format(filterEnd, "dd/MM/yy")}`;
  const isSDR = myCollaborator !== null;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Pré-vendas</h1>
        </div>
        <DateFilter
          startDate={filterStart}
          endDate={filterEnd}
          onStartDateChange={setFilterStart}
          onEndDateChange={setFilterEnd}
        />
      </div>

      {!isSDR && role === "admin" && (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-sm">
              Como administrador, você pode visualizar os dados de todos os SDRs abaixo. Apenas SDRs podem registrar seus próprios dados diários.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Weekly SDR Goals Card - like Dashboard MonthlyGoals */}
      {(() => {
        const month = filterStart.getMonth() + 1;
        const year = filterStart.getFullYear();
        const weekLabel = availableWeeks.find(w => w.weekNum === selectedWeek)?.label || `Sem ${selectedWeek}`;
        const hasAnyGoal = collaborators.some((c) => {
          const goal = sdrGoals.find((g) => g.collaborator_id === c.id && g.month === month && g.year === year && g.week_number === selectedWeek);
          return goal && (goal.conversations_goal > 0 || goal.replies_goal > 0 || goal.calls_goal > 0);
        });

        if (!hasAnyGoal && role !== "admin") return null;

        return (
          <div className="glass-card gradient-border p-6 opacity-0 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                  Metas Semanais dos SDRs
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                >
                  {availableWeeks.map((w) => (
                    <option key={w.weekNum} value={w.weekNum}>{w.label}</option>
                  ))}
                </select>
                {role === "admin" && (
                  <Button variant="ghost" size="sm" onClick={openGoalsDialog} className="text-xs">
                    Editar Metas
                  </Button>
                )}
              </div>
            </div>

            {hasAnyGoal ? (
              <div className="space-y-6 mt-4">
                {collaborators.map((collab) => {
                  const goal = sdrGoals.find((g) => g.collaborator_id === collab.id && g.month === month && g.year === year && g.week_number === selectedWeek);
                  if (!goal || (goal.conversations_goal === 0 && goal.replies_goal === 0 && goal.calls_goal === 0)) return null;

                  const metrics = metricsChartData.find((m) => m.name === collab.name);
                  const conversations = metrics?.["Conversas Iniciadas"] || 0;
                  const replies = metrics?.["Respostas"] || 0;
                  const calls = metrics?.["Calls Marcadas"] || 0;

                  const items = [
                    { label: "Conversas", actual: conversations, target: goal.conversations_goal },
                    { label: "Respostas", actual: replies, target: goal.replies_goal },
                    { label: "Calls Marcadas", actual: calls, target: goal.calls_goal },
                  ].filter((i) => i.target > 0);

                  return (
                    <div key={collab.id}>
                      <p className="text-sm font-semibold text-foreground mb-3">{collab.name}</p>
                      <div className="space-y-3">
                        {items.map((item) => {
                          const pct = Math.min((item.actual / item.target) * 100, 100);
                          return (
                            <div key={item.label} className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{item.label}</span>
                                <span className="font-semibold text-foreground">
                                  {item.actual} / {item.target}
                                </span>
                              </div>
                              <Progress value={pct} className="h-3" />
                              <p className="text-xs text-muted-foreground text-right">{pct.toFixed(1)}%</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Nenhuma meta definida para esta semana. Clique em "Editar Metas" para configurar.</p>
            )}
          </div>
        );
      })()}

      {/* SDR Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance dos SDRs — {filterLabel}
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

                  const month = filterStart.getMonth() + 1;
                  const year = filterStart.getFullYear();
                  const goal = sdrGoals.find((g) => g.collaborator_id === collab.id && g.month === month && g.year === year && g.week_number === selectedWeek);

                  const renderWithGoal = (actual: number, goalVal: number | undefined) => {
                    if (!goalVal || goalVal === 0) return <span>{actual}</span>;
                    const pct = Math.min((actual / goalVal) * 100, 100);
                    return (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs">{actual}/{goalVal}</span>
                        <Progress value={pct} className="h-1.5 w-16" />
                      </div>
                    );
                  };

                  return (
                    <TableRow key={collab.id}>
                      <TableCell className="font-medium">{collab.name}</TableCell>
                      <TableCell className="text-center">{renderWithGoal(conversations, goal?.conversations_goal)}</TableCell>
                      <TableCell className="text-center">{renderWithGoal(replies, goal?.replies_goal)}</TableCell>
                      <TableCell className="text-center">{renderWithGoal(calls, goal?.calls_goal)}</TableCell>
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

      {/* Goals Dialog */}
      <Dialog open={goalsDialogOpen} onOpenChange={setGoalsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Definir Metas dos SDRs — Semana {selectedWeek} ({format(filterStart, "MM/yyyy")})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {collaborators.map((collab) => (
              <div key={collab.id} className="border border-border rounded-lg p-4 space-y-3">
                <p className="font-medium text-foreground">{collab.name}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Conversas</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingGoals[collab.id]?.conversations ?? 0}
                      onChange={(e) => setEditingGoals((prev) => ({
                        ...prev,
                        [collab.id]: { ...prev[collab.id], conversations: Number(e.target.value) },
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Respostas</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingGoals[collab.id]?.replies ?? 0}
                      onChange={(e) => setEditingGoals((prev) => ({
                        ...prev,
                        [collab.id]: { ...prev[collab.id], replies: Number(e.target.value) },
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Calls</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingGoals[collab.id]?.calls ?? 0}
                      onChange={(e) => setEditingGoals((prev) => ({
                        ...prev,
                        [collab.id]: { ...prev[collab.id], calls: Number(e.target.value) },
                      }))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveGoals} disabled={savingGoals}>
              <Save className="h-4 w-4 mr-2" />
              {savingGoals ? "Salvando..." : "Salvar Metas"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SDR Metrics Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Métricas de Pré-venda — {filterLabel}</CardTitle>
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
            <p className="text-muted-foreground text-sm text-center py-10">Nenhum dado registrado neste período.</p>
          )}
        </CardContent>
      </Card>

      {/* Appointments Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agendamentos por SDR — {filterLabel}</CardTitle>
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
            <p className="text-muted-foreground text-sm text-center py-10">Nenhum agendamento encontrado neste período.</p>
          )}
        </CardContent>
      </Card>

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

      {/* Daily History Table */}
      {(isSDR || role === "admin") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Registros Diários</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const sdrMap = Object.fromEntries(collaborators.map((c) => [c.id, c.name]));
              const myEntries = isSDR
                ? allMetrics.filter((m) => m.collaborator_id === myCollaborator!.id).sort((a, b) => b.date.localeCompare(a.date))
                : allMetrics.sort((a, b) => b.date.localeCompare(a.date));

              if (myEntries.length === 0) {
                return <p className="text-muted-foreground text-sm text-center py-6">Nenhum registro encontrado no período.</p>;
              }

              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {role === "admin" && !isSDR && <TableHead>SDR</TableHead>}
                      <TableHead>Data</TableHead>
                      <TableHead className="text-center">Conversas</TableHead>
                      <TableHead className="text-center">Respostas</TableHead>
                      <TableHead className="text-center">Calls</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myEntries.map((entry) => (
                      <TableRow key={entry.id} className={selectedDate === entry.date && ((isSDR && entry.collaborator_id === myCollaborator?.id) || false) ? "bg-primary/5" : ""}>
                        {role === "admin" && !isSDR && (
                          <TableCell className="font-medium">{sdrMap[entry.collaborator_id] || "—"}</TableCell>
                        )}
                        <TableCell>{format(parseISO(entry.date), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-center">{entry.conversations_started}</TableCell>
                        <TableCell className="text-center">{entry.first_replies}</TableCell>
                        <TableCell className="text-center">{entry.calls_scheduled}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedDate(entry.date)}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PreSales;
