import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSales } from "@/context/SalesContext";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, Save, Loader2, Calendar, CalendarDays, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks, getWeek, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { CHART_COLORS } from "@/data/mockData";

interface Collaborator {
  id: string;
  name: string;
  type: string;
}

interface IndividualGoal {
  id: string;
  collaborator_id: string;
  month: number;
  year: number;
  week_number: number | null;
  period_type: string;
  goal_value: number;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getWeeksInMonth = (month: number, year: number) => {
  const start = new Date(year, month - 1, 1);
  const end = endOfMonth(start);
  const weeks: { number: number; start: Date; end: Date }[] = [];
  let current = start;
  let weekNum = 1;
  while (current <= end) {
    const weekStart = current;
    const weekEnd = new Date(Math.min(endOfWeek(current, { weekStartsOn: 1 }).getTime(), end.getTime()));
    weeks.push({ number: weekNum, start: weekStart, end: weekEnd });
    current = new Date(weekEnd.getTime() + 86400000);
    weekNum++;
  }
  return weeks;
};

const IndividualGoals = () => {
  const { sales } = useSales();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [periodType, setPeriodType] = useState<"monthly" | "weekly">("monthly");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [goals, setGoals] = useState<IndividualGoal[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const weeks = useMemo(() => getWeeksInMonth(month, year), [month, year]);

  useEffect(() => {
    const fetchData = async () => {
      const [collabRes, goalsRes] = await Promise.all([
        supabase.from("collaborators").select("id, name, type").order("name"),
        supabase
          .from("individual_goals")
          .select("*")
          .eq("month", month)
          .eq("year", year),
      ]);
      if (collabRes.data) setCollaborators(collabRes.data);
      if (goalsRes.data) {
        setGoals(goalsRes.data as IndividualGoal[]);
        const vals: Record<string, string> = {};
        (goalsRes.data as IndividualGoal[]).forEach((g) => {
          const key = `${g.collaborator_id}_${g.period_type}_${g.week_number || "m"}`;
          vals[key] = String(g.goal_value);
        });
        setEditValues(vals);
      }
      setLoaded(true);
    };
    fetchData();
  }, [month, year]);

  const sdrs = collaborators.filter((c) => c.type === "sdr");
  const closers = collaborators.filter((c) => c.type === "closer");

  // Calculate actuals from sales data
  const actuals = useMemo(() => {
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);
    const monthlySales = sales.filter((s) => {
      const d = new Date(s.date);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });

    const result: Record<string, { monthly: number; weeks: Record<number, number> }> = {};

    collaborators.forEach((c) => {
      result[c.id] = { monthly: 0, weeks: {} };
      weeks.forEach((w) => (result[c.id].weeks[w.number] = 0));
    });

    monthlySales.forEach((s) => {
      const saleDate = new Date(s.date);
      // SDR: count appointments (all statuses)
      sdrs.forEach((sdr) => {
        if (s.sdr === sdr.name) {
          if (result[sdr.id]) {
            result[sdr.id].monthly += 1;
            weeks.forEach((w) => {
              if (isWithinInterval(saleDate, { start: w.start, end: w.end })) {
                result[sdr.id].weeks[w.number] += 1;
              }
            });
          }
        }
      });
      // Closer: sum revenue (only "Pago")
      if (s.status === "Pago") {
        closers.forEach((closer) => {
          if (s.closer === closer.name) {
            if (result[closer.id]) {
              result[closer.id].monthly += s.netValue;
              weeks.forEach((w) => {
                if (isWithinInterval(saleDate, { start: w.start, end: w.end })) {
                  result[closer.id].weeks[w.number] += s.netValue;
                }
              });
            }
          }
        });
      }
    });

    return result;
  }, [sales, collaborators, month, year, weeks, sdrs, closers]);

  const getGoalValue = (collabId: string, pType: string, weekNum: number | null) => {
    const key = `${collabId}_${pType}_${weekNum || "m"}`;
    return parseFloat(editValues[key] || "0") || 0;
  };

  const getExistingGoal = (collabId: string, pType: string, weekNum: number | null) => {
    return goals.find(
      (g) =>
        g.collaborator_id === collabId &&
        g.period_type === pType &&
        g.week_number === weekNum
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const upserts: any[] = [];

    collaborators.forEach((c) => {
      if (periodType === "monthly") {
        const key = `${c.id}_monthly_m`;
        const val = parseFloat(editValues[key] || "0") || 0;
        upserts.push({
          collaborator_id: c.id,
          month,
          year,
          period_type: "monthly",
          week_number: null,
          goal_value: val,
        });
      } else {
        weeks.forEach((w) => {
          const key = `${c.id}_weekly_${w.number}`;
          const val = parseFloat(editValues[key] || "0") || 0;
          upserts.push({
            collaborator_id: c.id,
            month,
            year,
            period_type: "weekly",
            week_number: w.number,
            goal_value: val,
          });
        });
      }
    });

    const { error } = await supabase
      .from("individual_goals")
      .upsert(upserts, { onConflict: "collaborator_id,month,year,period_type,week_number" });

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar metas: " + error.message);
    } else {
      toast.success("Metas salvas com sucesso!");
      setEditing(false);
      // Refresh goals
      const { data } = await supabase
        .from("individual_goals")
        .select("*")
        .eq("month", month)
        .eq("year", year);
      if (data) setGoals(data as IndividualGoal[]);
    }
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const buildChartData = (collabList: Collaborator[], isSdr: boolean) => {
    return collabList.map((c) => {
      const goalVal = goals.find(
        (g) => g.collaborator_id === c.id && g.period_type === "monthly" && g.week_number === null
      )?.goal_value || 0;
      const actual = actuals[c.id]?.monthly || 0;
      return { name: c.name, Meta: goalVal, Realizado: actual };
    });
  };

  const buildWeeklyChartData = (collab: Collaborator, isSdr: boolean) => {
    return weeks.map((w) => {
      const wGoal = goals.find(
        (g) => g.collaborator_id === collab.id && g.period_type === "weekly" && g.week_number === w.number
      )?.goal_value || 0;
      const wActual = actuals[collab.id]?.weeks[w.number] || 0;
      return { name: `S${w.number}`, Meta: wGoal, Realizado: wActual };
    });
  };

  const CustomTooltip = ({ active, payload, label, isSdr }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="text-xs" style={{ color: p.color }}>
            {p.name}: {isSdr ? p.value : formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  const renderGroupedBarChart = (collabList: Collaborator[], isSdr: boolean, title: string) => {
    const data = buildChartData(collabList, isSdr);
    const hasData = data.some((d) => d.Meta > 0 || d.Realizado > 0);

    return (
      <Card className="glass-card gradient-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground flex items-center gap-2">
            {isSdr ? <Users className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} barGap={4} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={isSdr ? undefined : (v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip isSdr={isSdr} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Meta" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realizado" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma meta definida</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderWeeklyCharts = (collabList: Collaborator[], isSdr: boolean) => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {collabList.map((c) => {
          const data = buildWeeklyChartData(c, isSdr);
          const hasData = data.some((d) => d.Meta > 0 || d.Realizado > 0);
          if (!hasData) return null;
          return (
            <Card key={c.id} className="glass-card gradient-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  {isSdr ? <CalendarDays className="h-4 w-4 text-primary" /> : <TrendingUp className="h-4 w-4 text-primary" />}
                  {c.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data} barGap={4} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={isSdr ? undefined : (v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip isSdr={isSdr} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Meta" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Realizado" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderEditCards = (collabList: Collaborator[], isSdr: boolean) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {collabList.map((collab) => {
        const goalKey = `${collab.id}_monthly_m`;
        return (
          <Card key={collab.id} className="glass-card gradient-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {isSdr ? <CalendarDays className="h-4 w-4 text-primary" /> : <TrendingUp className="h-4 w-4 text-primary" />}
                {collab.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Meta {isSdr ? "(agendamentos)" : "(R$)"}
                </Label>
                <Input
                  type="number"
                  value={editValues[goalKey] || ""}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, [goalKey]: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderWeeklyEditTable = (collabList: Collaborator[], isSdr: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          {weeks.map((w) => (
            <TableHead key={w.number} className="text-center">S{w.number}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {collabList.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.name}</TableCell>
            {weeks.map((w) => {
              const key = `${c.id}_weekly_${w.number}`;
              return (
                <TableCell key={w.number} className="text-center">
                  <Input
                    type="number"
                    className="w-20 mx-auto text-center"
                    value={editValues[key] || ""}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="0"
                  />
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderSummaryTable = (collabList: Collaborator[], isSdr: boolean) => {
    const rows = collabList.map((c) => {
      const goalVal = goals.find(
        (g) => g.collaborator_id === c.id && g.period_type === "monthly" && g.week_number === null
      )?.goal_value || 0;
      const actual = actuals[c.id]?.monthly || 0;
      const pct = goalVal > 0 ? ((actual / goalVal) * 100) : 0;
      return { name: c.name, goal: goalVal, actual, pct };
    });

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead className="text-right">Meta</TableHead>
            <TableHead className="text-right">Realizado</TableHead>
            <TableHead className="text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right">
                {isSdr ? r.goal : formatCurrency(r.goal)}
              </TableCell>
              <TableCell className="text-right">
                {isSdr ? r.actual : formatCurrency(r.actual)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                <span className={r.pct >= 100 ? "text-green-500" : r.pct >= 70 ? "text-yellow-500" : "text-muted-foreground"}>
                  {r.pct.toFixed(1)}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Metas Individuais</h1>
            <p className="text-sm text-muted-foreground">
              {monthNames[month - 1]} {year}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((name, i) => (
                <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && !editing && (
            <Button onClick={() => setEditing(true)} size="sm">
              <Target className="h-4 w-4 mr-1" /> Editar Metas
            </Button>
          )}
          {editing && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Salvar</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          )}
        </div>
      </div>

      {/* Period toggle */}
      <Tabs value={periodType} onValueChange={(v) => setPeriodType(v as "monthly" | "weekly")}>
        <TabsList>
          <TabsTrigger value="monthly" className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Mensal
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" /> Semanal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-8 mt-6">
          {/* SDR Section */}
          {sdrs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> SDRs — Meta por Agendamentos
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sdrs.map((s) => renderCollaboratorCard(s, true))}
              </div>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  {renderSummaryTable(sdrs, true)}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Closer Section */}
          {closers.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Closers — Meta por Faturamento
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {closers.map((c) => renderCollaboratorCard(c, false))}
              </div>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  {renderSummaryTable(closers, false)}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-8 mt-6">
          {editing && isAdmin ? (
            <>
              {sdrs.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                    SDRs — Meta Semanal (Agendamentos)
                  </h2>
                  <Card className="glass-card overflow-x-auto">
                    <CardContent className="pt-6">
                      {renderWeeklyEditTable(sdrs, true)}
                    </CardContent>
                  </Card>
                </div>
              )}
              {closers.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                    Closers — Meta Semanal (R$)
                  </h2>
                  <Card className="glass-card overflow-x-auto">
                    <CardContent className="pt-6">
                      {renderWeeklyEditTable(closers, false)}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          ) : (
            <>
              {sdrs.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> SDRs — Meta Semanal
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sdrs.map((s) => renderCollaboratorCard(s, true))}
                  </div>
                </div>
              )}
              {closers.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold tracking-[0.1em] uppercase text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Closers — Meta Semanal
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {closers.map((c) => renderCollaboratorCard(c, false))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IndividualGoals;
