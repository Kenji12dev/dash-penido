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
import { format, startOfMonth, endOfMonth, endOfDay, parseISO, isWithinInterval, startOfDay, getDaysInMonth, differenceInCalendarDays } from "date-fns";
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
  const [editingGoals, setEditingGoals] = useState<Record<string, { calls: number }>>({});
  const [savingGoals, setSavingGoals] = useState(false);
  

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
    const initial: Record<string, { calls: number }> = {};
    collaborators.forEach((c) => {
      const goal = sdrGoals.find((g) => g.collaborator_id === c.id && g.month === month && g.year === year);
      initial[c.id] = {
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
      const existing = sdrGoals.find((g) => g.collaborator_id === collab.id && g.month === month && g.year === year);

      if (existing) {
        await supabase
          .from("sdr_goals")
          .update({
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
            week_number: 1,
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
    const sdrCounts: Record<string, { total: number; pago: number; pendente: number; followUp: number; loss: number; noShow: number; reembolsado: number }> = {};
    sdrNames.forEach((name) => {
      sdrCounts[name] = { total: 0, pago: 0, pendente: 0, followUp: 0, loss: 0, noShow: 0, reembolsado: 0 };
    });
    filteredSales.forEach((sale) => {
      if (sdrCounts[sale.sdr]) {
        sdrCounts[sale.sdr].total++;
        const status = sale.status.toLowerCase();
        if (status === "pago") sdrCounts[sale.sdr].pago++;
        else if (status === "pendente") sdrCounts[sale.sdr].pendente++;
        else if (status === "follow up") sdrCounts[sale.sdr].followUp++;
        else if (status === "loss") sdrCounts[sale.sdr].loss++;
        else if (status === "no show") sdrCounts[sale.sdr].noShow++;
        else if (status === "reembolsado") sdrCounts[sale.sdr].reembolsado++;
      }
    });
    return sdrNames.map((name) => ({
      name,
      Total: sdrCounts[name]?.total || 0,
      Pago: sdrCounts[name]?.pago || 0,
      Pendente: sdrCounts[name]?.pendente || 0,
      "Follow Up": sdrCounts[name]?.followUp || 0,
      Loss: sdrCounts[name]?.loss || 0,
      "No Show": sdrCounts[name]?.noShow || 0,
      Reembolsado: sdrCounts[name]?.reembolsado || 0,
    }));
  }, [filteredSales, collaborators]);

  // Build SDR metrics comparison chart - calls come from sales (appointments)
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
      }
    });
    // Count calls from actual sales/appointments
    filteredSales.forEach((sale) => {
      if (totals[sale.sdr]) {
        totals[sale.sdr].calls++;
      }
    });
    return sdrNames.map((name) => ({
      name,
      "Conversas Iniciadas": totals[name]?.conversations || 0,
      "Respostas": totals[name]?.replies || 0,
      "Calls Marcadas": totals[name]?.calls || 0,
    }));
  }, [allMetrics, collaborators, filteredSales]);

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

      {!isSDR && role === "colaborador" && (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-sm">
              Seu usuário ainda não está vinculado a um SDR. Peça ao administrador para vincular seu usuário ao seu registro de colaborador na aba de Colaboradores.
            </p>
          </CardContent>
        </Card>
      )}

      {!isSDR && role === "visualizador" && (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-sm">
              Você está no modo visualização. Os dados abaixo são apenas leitura.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Monthly SDR Goals Card with daily pace */}
      {(() => {
        const month = filterStart.getMonth() + 1;
        const year = filterStart.getFullYear();
        const totalDays = getDaysInMonth(new Date(year, month - 1));
        const today = new Date();
        const monthStart = startOfMonth(new Date(year, month - 1));
        const daysPassed = Math.min(
          differenceInCalendarDays(today, monthStart) + 1,
          totalDays
        );
        if (collaborators.length === 0) return null;

        return (
          <div className="glass-card gradient-border p-6 opacity-0 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                  Metas Mensais dos SDRs — {format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR })}
                </h2>
              </div>
              {role === "admin" && (
                <Button variant="ghost" size="sm" onClick={openGoalsDialog} className="text-xs">
                  Editar Metas
                </Button>
              )}
            </div>

        {collaborators.length > 0 ? (
              <div className="space-y-6 mt-4">
                {collaborators.map((collab) => {
                  const goal = sdrGoals.find((g) => g.collaborator_id === collab.id && g.month === month && g.year === year);
                  const callsGoal = goal?.calls_goal || 0;

                  const metrics = metricsChartData.find((m) => m.name === collab.name);
                  const calls = metrics?.["Calls Marcadas"] || 0;
                  const pct = callsGoal > 0 ? Math.min((calls / callsGoal) * 100, 100) : 0;
                  const idealPace = callsGoal > 0 ? Math.round((callsGoal / totalDays) * daysPassed) : 0;
                  const dailyAvg = daysPassed > 0 ? (calls / daysPassed).toFixed(1) : "0.0";
                  const needsPerDay = callsGoal > 0 && daysPassed < totalDays 
                    ? Math.max(0, Math.ceil((callsGoal - calls) / (totalDays - daysPassed)))
                    : 0;

                  return (
                    <div key={collab.id}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">{collab.name}</p>
                        <span className="text-xs text-muted-foreground">Dia {daysPassed}/{totalDays}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Calls Marcadas</span>
                          <span className="font-semibold text-foreground">
                            {calls} / {callsGoal || "—"}
                          </span>
                        </div>
                        <div className="relative">
                        {callsGoal > 0 && (
                          <>
                            <Progress value={pct} className="h-3" />
                            {/* Ideal pace marker */}
                            <div 
                              className="absolute top-0 h-3 w-0.5 bg-foreground/40"
                              style={{ left: `${Math.min((idealPace / callsGoal) * 100, 100)}%` }}
                              title={`Ritmo ideal: ${idealPace}`}
                            />
                          </>
                        )}
                        {callsGoal === 0 && (
                          <p className="text-xs text-muted-foreground italic">Sem meta definida</p>
                        )}
                        </div>
                        <div className="flex items-center justify-end text-xs text-muted-foreground">
                          <span className="font-medium">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Nenhuma meta definida para este mês. Clique em "Editar Metas" para configurar.</p>
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
                <TableHead className="text-center">No Show</TableHead>
                <TableHead className="text-center">Reembolsado</TableHead>
                <TableHead className="text-center">Taxa Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaborators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-muted-foreground py-10">
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

      {/* Goals Dialog */}
      <Dialog open={goalsDialogOpen} onOpenChange={setGoalsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Definir Metas dos SDRs — {format(filterStart, "MMMM yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {collaborators.map((collab) => (
              <div key={collab.id} className="border border-border rounded-lg p-4 space-y-3">
                <p className="font-medium text-foreground">{collab.name}</p>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Calls Marcadas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editingGoals[collab.id]?.calls ?? 0}
                    onChange={(e) => setEditingGoals((prev) => ({
                      ...prev,
                      [collab.id]: { calls: Number(e.target.value) },
                    }))}
                  />
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

      {/* Funil de Conversão por SDR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Funil de Conversão por SDR — {filterLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {collaborators.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-10">Nenhum SDR cadastrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {collaborators.map((collab) => {
                const metrics = metricsChartData.find((m) => m.name === collab.name);
                const conversations = metrics?.["Conversas Iniciadas"] || 0;
                const replies = metrics?.["Respostas"] || 0;
                const calls = metrics?.["Calls Marcadas"] || 0;

                const replyRate = conversations > 0 ? ((replies / conversations) * 100).toFixed(1) : "0.0";
                const callRate = replies > 0 ? ((calls / replies) * 100).toFixed(1) : "0.0";
                const overallRate = conversations > 0 ? ((calls / conversations) * 100).toFixed(1) : "0.0";

                const maxVal = Math.max(conversations, 1);

                const funnelSteps = [
                  { stage: "Conversas Iniciadas", value: conversations, color: "hsl(var(--primary))" },
                  { stage: "Respostas 1ª Msg", value: replies, color: "hsl(var(--accent))" },
                  { stage: "Calls Marcadas", value: calls, color: "hsl(220, 70%, 55%)" },
                ];

                return (
                  <div key={collab.id} className="border border-border rounded-lg p-4 space-y-4">
                    <p className="font-semibold text-foreground text-sm">{collab.name}</p>
                    
                    <div className="space-y-3">
                      {funnelSteps.map((item, idx) => {
                        const widthPct = maxVal > 0 ? Math.max((item.value / maxVal) * 100, 4) : 4;
                        return (
                          <div key={item.stage} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{item.stage}</span>
                              <span className="font-semibold text-foreground">{item.value}</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-6 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                style={{ width: `${widthPct}%`, backgroundColor: item.color }}
                              >
                                {widthPct > 15 && (
                                  <span className="text-[10px] font-medium text-white">{item.value}</span>
                                )}
                              </div>
                            </div>
                            {idx < funnelSteps.length - 1 && (
                              <div className="flex justify-center">
                                <span className="text-[10px] text-muted-foreground">
                                  ↓ {idx === 0 ? `${replyRate}%` : `${callRate}%`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Conversão geral (Conversa → Call)</span>
                        <span className="font-bold text-primary">{overallRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SDR Daily Input - hidden for viewers */}
      {isSDR && role !== "visualizador" && (
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
      {(isSDR || role === "admin" || role === "visualizador") && (
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
                      {role !== "visualizador" && <TableHead className="text-center">Ações</TableHead>}
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
                        {role !== "visualizador" && (
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
                        )}
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
