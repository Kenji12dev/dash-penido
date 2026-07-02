import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useSales } from "@/context/SalesContext";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, User, Plus, Pencil, Trash2, Save, X, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LEAD_SOURCES } from "@/data/mockData";

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  htmlLink: string;
  location: string;
  status: string;
}

interface Collaborator {
  id: string;
  name: string;
  type: string;
}

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

// Fixed SDR color map for consistency across all closers' calendars
const SDR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Juan Bandeira": { bg: "bg-sky-500/80", border: "border-sky-400", text: "text-white" },
};

const DEFAULT_EVENT_COLOR = { bg: "bg-zinc-500/60", border: "border-zinc-400", text: "text-white" };

function extractSdrFromDescription(description: string): string | null {
  const match = description.match(/SDR:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function getEventColor(event: CalendarEvent) {
  const sdr = extractSdrFromDescription(event.description);
  if (sdr && SDR_COLORS[sdr]) return SDR_COLORS[sdr];
  // Fallback: hash by summary for non-system events
  if (sdr) {
    let hash = 0;
    for (let i = 0; i < sdr.length; i++) {
      hash = sdr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = Object.values(SDR_COLORS);
    return colors.length > 0 ? colors[Math.abs(hash) % colors.length] : DEFAULT_EVENT_COLOR;
  }
  return DEFAULT_EVENT_COLOR;
}

function getEventPosition(event: CalendarEvent) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const topMinutes = startMinutes - START_HOUR * 60;
  const duration = Math.max(endMinutes - startMinutes, 20);
  return {
    top: (topMinutes / 60) * HOUR_HEIGHT,
    height: (duration / 60) * HOUR_HEIGHT,
  };
}

function isAllDay(event: CalendarEvent) {
  return !event.start || event.start.length <= 10;
}

const Agenda = () => {
  const { role } = useAuth();
  const isViewer = role === "visualizador";
  const { addSale, products, closers, sdrs } = useSales();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  // Add scheduling dialog (same as Kanban)
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("11:00");
  const [newClient, setNewClient] = useState("");
  const [newProduct, setNewProduct] = useState("");
  const [newCloser, setNewCloser] = useState("");
  const [newSdr, setNewSdr] = useState("");
  const [newLeadSource, setNewLeadSource] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit event dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("10:00");
  const [editEndTime, setEditEndTime] = useState("11:00");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const fetchCollaborators = async () => {
      const { data } = await supabase
        .from("collaborators")
        .select("id, name, type")
        .ilike("type", "closer")
        .order("name");
      if (data && data.length > 0) {
        setCollaborators(data);
        setSelectedCollaborator(data[0].id);
      }
    };
    fetchCollaborators();
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!selectedCollaborator) return;
    setLoading(true);
    const { data } = await supabase.functions.invoke("google-calendar-events", {
      body: {
        collaborator_id: selectedCollaborator,
        time_min: weekStart.toISOString(),
        time_max: addDays(weekEnd, 1).toISOString(),
      },
    });
    setEvents(data?.events || []);
    setLoading(false);
  }, [selectedCollaborator, weekStart]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const { timedEvents, allDayEvents } = useMemo(() => {
    const timed: CalendarEvent[] = [];
    const allDay: CalendarEvent[] = [];
    events.forEach((ev) => {
      if (isAllDay(ev)) allDay.push(ev);
      else timed.push(ev);
    });
    return { timedEvents: timed, allDayEvents: allDay };
  }, [events]);

  const getEventsForDay = (day: Date, list: CalendarEvent[]) =>
    list.filter((ev) => isSameDay(parseISO(ev.start), day));

  const formatTime = (iso: string) => {
    if (!iso || iso.length <= 10) return "";
    return format(parseISO(iso), "HH:mm");
  };

  // Get selected collaborator name
  const selectedCollaboratorName = collaborators.find((c) => c.id === selectedCollaborator)?.name || "";

  // Open add dialog
  const handleNewEvent = (day?: Date) => {
    setNewDate(day || new Date());
    setNewStartTime("10:00");
    setNewEndTime("11:00");
    setNewClient("");
    setNewProduct("");
    setNewCloser(selectedCollaboratorName);
    setNewSdr("");
    setNewLeadSource("");
    setNewNotes("");
    setAddOpen(true);
  };

  // Save new scheduling (same logic as Kanban)
  const handleAddSave = async () => {
    if (!newClient || !newProduct || !newCloser || !newSdr || !newLeadSource) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const createdSale = await addSale({
      date: newDate,
      clientName: newClient.trim(),
      product: newProduct,
      grossValue: 0,
      netValue: 0,
      paymentMethod: "",
      closer: newCloser,
      sdr: newSdr,
      status: "Pendente",
      leadSource: newLeadSource,
      notes: newNotes.trim(),
    });

    if (!createdSale) return;
    toast.success("Agendamento criado!");

    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-event", {
        body: {
          collaborator_name: newCloser,
          client_name: newClient.trim(),
          product: newProduct,
          date: newDate.toISOString(),
          start_time: newStartTime,
          end_time: newEndTime,
          notes: newNotes.trim(),
          sdr: newSdr,
        },
      });
      if (data?.success) {
        toast.success("📅 Evento criado no Google Calendar!", { duration: 4000 });
      } else if (data?.skipped) {
        toast.warning(data?.error || "Google Calendar não vinculado para este closer", { duration: 5000 });
      } else if (error || data?.error) {
        toast.warning("Falha ao criar evento no Calendar: " + (data?.error || error?.message), { duration: 5000 });
      }
    } catch (err) {
      console.warn("Calendar integration error:", err);
    }

    setAddOpen(false);
    fetchEvents();
  };

  // Open edit dialog for existing event
  const handleEditEvent = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setEditSummary(ev.summary);
    setEditDescription(ev.description);
    setEditLocation(ev.location);
    const startDate = parseISO(ev.start);
    setEditDate(format(startDate, "yyyy-MM-dd"));
    setEditStartTime(ev.start.length > 10 ? format(startDate, "HH:mm") : "10:00");
    setEditEndTime(ev.end.length > 10 ? format(parseISO(ev.end), "HH:mm") : "11:00");
    setEditOpen(true);
  };

  // Save edit
  const handleEditSave = async () => {
    if (!editSummary.trim() || !editDate) {
      toast.error("Título e data são obrigatórios");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("google-calendar-manage", {
      body: {
        action: "update",
        collaborator_id: selectedCollaborator,
        event_id: editingEvent?.id,
        event_data: {
          summary: editSummary,
          description: editDescription,
          location: editLocation,
          date: editDate,
          start_time: editStartTime,
          end_time: editEndTime,
        },
      },
    });
    setSaving(false);
    if (data?.success) {
      toast.success("Evento atualizado! ✅");
      setEditOpen(false);
      fetchEvents();
    } else {
      toast.error(data?.error || error?.message || "Erro ao salvar evento");
    }
  };

  // Delete event
  const handleDelete = async () => {
    if (!editingEvent) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("google-calendar-manage", {
      body: {
        action: "delete",
        collaborator_id: selectedCollaborator,
        event_id: editingEvent.id,
      },
    });
    setDeleting(false);
    if (data?.success) {
      toast.success("Evento excluído! 🗑️");
      setEditOpen(false);
      fetchEvents();
    } else {
      toast.error(data?.error || error?.message || "Erro ao excluir evento");
    }
  };

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h1 className="text-lg font-bold text-foreground">
            {format(weekStart, "MMMM yyyy", { locale: ptBR })}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="text-xs"
          >
            Hoje
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {!isViewer && (
            <Button size="sm" onClick={() => handleNewEvent()} className="font-semibold">
              <Plus className="h-4 w-4 mr-1" />
              Novo Agendamento
            </Button>
          )}
          <User className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecionar closer" />
            </SelectTrigger>
            <SelectContent>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SDR color legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Legenda SDR:</span>
        {Object.entries(SDR_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", color.bg)} />
            <span className="text-xs text-foreground">{name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded-sm", DEFAULT_EVENT_COLOR.bg)} />
          <span className="text-xs text-muted-foreground">Outros</span>
        </div>
      </div>
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <div className="glass-card gradient-border rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
            <div className="border-r border-border" />
            {weekDays.map((day) => {
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn("text-center py-3 border-r border-border last:border-r-0 transition-colors", !isViewer && "cursor-pointer hover:bg-secondary/30")}
                  onClick={() => !isViewer && handleNewEvent(day)}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <div
                    className={cn(
                      "w-9 h-9 mx-auto flex items-center justify-center rounded-full text-lg font-bold mt-0.5",
                      today ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All-day events row */}
          {allDayEvents.length > 0 && (
            <div className="grid border-b border-border" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
              <div className="border-r border-border p-1 text-[10px] text-muted-foreground flex items-center justify-end pr-2">
                dia todo
              </div>
              {weekDays.map((day) => {
                const dayAllDay = getEventsForDay(day, allDayEvents);
                return (
                  <div key={day.toISOString()} className="border-r border-border last:border-r-0 p-1 space-y-0.5">
                    {dayAllDay.map((ev) => {
                      const color = getEventColor(ev);
                      return (
                        <button
                          key={ev.id}
                          onClick={() => handleEditEvent(ev)}
                          className={cn(
                            "block w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border-l-2 hover:brightness-110 transition-all",
                            color.bg, color.border, color.text
                          )}
                        >
                          {ev.summary}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Time grid */}
          <div className="overflow-y-auto max-h-[calc(100vh-240px)]" style={{ scrollbarGutter: "stable" }}>
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: "60px repeat(7, 1fr)",
                height: `${HOURS.length * HOUR_HEIGHT}px`,
              }}
            >
              {/* Hour labels */}
              <div className="relative border-r border-border">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute right-0 pr-2 text-[10px] text-muted-foreground"
                    style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT - 6}px` }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const dayEvents = getEventsForDay(day, timedEvents);
                const today = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "relative border-r border-border last:border-r-0",
                      today && "bg-primary/[0.03]"
                    )}
                  >
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-border/50"
                        style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {dayEvents.map((ev) => {
                      const pos = getEventPosition(ev);
                      const color = getEventColor(ev);
                      return (
                        <button
                          key={ev.id}
                          onClick={() => handleEditEvent(ev)}
                          className={cn(
                            "absolute left-0.5 right-1 rounded-md border-l-[3px] px-1.5 py-1 overflow-hidden text-left group hover:brightness-110 hover:shadow-lg transition-all z-10 cursor-pointer",
                            color.bg, color.border, color.text
                          )}
                          style={{
                            top: `${pos.top}px`,
                            height: `${Math.max(pos.height, 20)}px`,
                          }}
                        >
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="h-3 w-3" />
                          </div>
                          <p className="text-[11px] font-semibold leading-tight line-clamp-2">
                            {ev.summary}
                          </p>
                          {pos.height > 30 && (
                            <p className="text-[10px] opacity-80 mt-0.5">
                              {formatTime(ev.start)} – {formatTime(ev.end)}
                            </p>
                          )}
                          {pos.height > 50 && ev.location && (
                            <p className="text-[9px] opacity-70 mt-0.5 truncate">
                              {ev.location}
                            </p>
                          )}
                        </button>
                      );
                    })}

                    {today && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 && (
                      <div
                        className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                        style={{ top: `${nowTop}px` }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1" />
                        <div className="flex-1 h-[2px] bg-destructive" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && events.length === 0 && selectedCollaborator && (
        <div className="text-center py-12">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum evento encontrado. Verifique se o Google Calendar está vinculado.
          </p>
        </div>
      )}

      {/* Add Scheduling Dialog (same as Kanban) */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>Preencha os dados do agendamento. Será criado como "Pendente" e sincronizado com o Google Calendar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(newDate, "dd MMM yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Início *</Label>
                <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Fim *</Label>
                <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Cliente *</Label>
              <Input placeholder="Nome do cliente" value={newClient} onChange={(e) => setNewClient(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Produto *</Label>
                <Select value={newProduct} onValueChange={setNewProduct}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Origem *</Label>
                <Select value={newLeadSource} onValueChange={setNewLeadSource}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{LEAD_SOURCES.map((ls) => <SelectItem key={ls} value={ls}>{ls}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Closer *</Label>
                <Select value={newCloser} onValueChange={setNewCloser}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{closers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">SDR *</Label>
                <Select value={newSdr} onValueChange={setNewSdr}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{sdrs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Observações</Label>
              <Textarea placeholder="Briefing, anotações..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddSave} className="flex-1 font-semibold">
                <Save className="h-4 w-4 mr-1" /> Criar Agendamento
              </Button>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{isViewer ? "Detalhes do Evento" : "Editar Evento"}</DialogTitle>
            <DialogDescription>
              {isViewer
                ? "Visualização dos dados do evento. Você não tem permissão para editar."
                : "Edite os dados do evento. As alterações serão sincronizadas com o Google Calendar."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ev-summary">Título {!isViewer && "*"}</Label>
              <Input
                id="ev-summary"
                placeholder="Título do evento"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                disabled={isViewer}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ev-date">Data {!isViewer && "*"}</Label>
                <Input
                  id="ev-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  disabled={isViewer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-start">Início</Label>
                <Input
                  id="ev-start"
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  disabled={isViewer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-end">Fim</Label>
                <Input
                  id="ev-end"
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  disabled={isViewer}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-location">Local</Label>
              <Input
                id="ev-location"
                placeholder="Local (opcional)"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                disabled={isViewer}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-desc">Descrição</Label>
              <Textarea
                id="ev-desc"
                placeholder="Descrição (opcional)"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                disabled={isViewer}
              />
            </div>
          </div>
          {!isViewer && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="gap-1.5 sm:mr-auto"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving || deleting}>
                Cancelar
              </Button>
              <Button onClick={handleEditSave} disabled={saving || deleting} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          )}
          {isViewer && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agenda;
