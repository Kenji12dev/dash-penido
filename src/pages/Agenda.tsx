import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { CalendarDays, Clock, MapPin, ExternalLink, Loader2, ChevronLeft, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO, isToday } from "date-fns";
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

const Agenda = () => {
  const { role } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
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
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
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

  const getEventsForDay = (day: Date) =>
    events.filter((ev) => {
      const evDate = parseISO(ev.start);
      return isSameDay(evDate, day);
    });

  const formatTime = (iso: string) => {
    if (!iso || iso.length <= 10) return "Dia inteiro";
    return format(parseISO(iso), "HH:mm");
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Visualize a agenda do Google Calendar dos closers
          </p>
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

      {/* Week navigation */}
      <div className="flex items-center justify-between glass-card gradient-border p-4">
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {format(weekStart, "dd MMM", { locale: ptBR })} — {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
          </p>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="text-xs text-primary hover:underline mt-1"
          >
            Ir para hoje
          </button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Week grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dayEvents = getEventsForDay(day);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "glass-card gradient-border p-3 min-h-[160px] rounded-xl",
                  today && "ring-2 ring-primary/40"
                )}
              >
                <div className={cn("text-center mb-3 pb-2 border-b border-border")}>
                  <p className="text-xs text-muted-foreground uppercase">
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      today ? "text-primary" : "text-foreground"
                    )}
                  >
                    {format(day, "dd")}
                  </p>
                </div>
                <div className="space-y-2">
                  {dayEvents.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Sem eventos</p>
                  )}
                  {dayEvents.map((ev) => (
                    <a
                      key={ev.id}
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors group"
                    >
                      <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {ev.summary}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(ev.start)}
                          {ev.end && ev.start.length > 10 && ` – ${formatTime(ev.end)}`}
                        </span>
                      </div>
                      {ev.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground line-clamp-1">
                            {ev.location}
                          </span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && events.length === 0 && selectedCollaborator && (
        <div className="text-center py-8">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum evento encontrado nesta semana. Verifique se o Google Calendar está vinculado.
          </p>
        </div>
      )}
    </div>
  );
};

export default Agenda;
