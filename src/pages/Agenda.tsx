import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO, isToday, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 7;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

// Color palette for events
const EVENT_COLORS = [
  { bg: "bg-sky-500/80", border: "border-sky-400", text: "text-white" },
  { bg: "bg-rose-500/70", border: "border-rose-400", text: "text-white" },
  { bg: "bg-violet-500/70", border: "border-violet-400", text: "text-white" },
  { bg: "bg-emerald-500/70", border: "border-emerald-400", text: "text-white" },
  { bg: "bg-amber-500/70", border: "border-amber-400", text: "text-white" },
  { bg: "bg-cyan-500/70", border: "border-cyan-400", text: "text-white" },
  { bg: "bg-pink-500/70", border: "border-pink-400", text: "text-white" },
  { bg: "bg-indigo-500/70", border: "border-indigo-400", text: "text-white" },
];

function getEventColor(summary: string) {
  let hash = 0;
  for (let i = 0; i < summary.length; i++) {
    hash = summary.charCodeAt(i) + ((hash << 5) - hash);
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
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
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const fetchCollaborators = async () => {
      const { data } = await supabase
        .from("collaborators")
        .select("id, name, type")
        .eq("type", "Closer")
        .order("name");
      if (data && data.length > 0) {
        setCollaborators(data);
        setSelectedCollaborator(data[0].id);
      }
    };
    fetchCollaborators();
  }, []);

  useEffect(() => {
    if (!selectedCollaborator) return;
    const fetchEvents = async () => {
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
    };
    fetchEvents();
  }, [selectedCollaborator, weekStart]);

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
    list.filter((ev) => {
      const evDate = parseISO(ev.start);
      return isSameDay(evDate, day);
    });

  const formatTime = (iso: string) => {
    if (!iso || iso.length <= 10) return "";
    return format(parseISO(iso), "HH:mm");
  };

  // Current time indicator
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const todayIndex = weekDays.findIndex((d) => isToday(d));

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
                  className={cn(
                    "text-center py-3 border-r border-border last:border-r-0",
                  )}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <div
                    className={cn(
                      "w-9 h-9 mx-auto flex items-center justify-center rounded-full text-lg font-bold mt-0.5",
                      today
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
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
                      const color = getEventColor(ev.summary);
                      return (
                        <a
                          key={ev.id}
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "block px-1.5 py-0.5 rounded text-[10px] font-medium truncate border-l-2",
                            color.bg, color.border, color.text
                          )}
                        >
                          {ev.summary}
                        </a>
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
              {weekDays.map((day, dayIndex) => {
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
                    {/* Hour lines */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-border/50"
                        style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {/* Events */}
                    {dayEvents.map((ev) => {
                      const pos = getEventPosition(ev);
                      const color = getEventColor(ev.summary);
                      return (
                        <a
                          key={ev.id}
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "absolute left-0.5 right-1 rounded-md border-l-[3px] px-1.5 py-1 overflow-hidden group hover:brightness-110 transition-all z-10",
                            color.bg, color.border, color.text
                          )}
                          style={{
                            top: `${pos.top}px`,
                            height: `${Math.max(pos.height, 20)}px`,
                          }}
                        >
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
                        </a>
                      );
                    })}

                    {/* Current time line */}
                    {today && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 && (
                      <div
                        className="absolute left-0 right-0 z-20 flex items-center"
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
    </div>
  );
};

export default Agenda;
