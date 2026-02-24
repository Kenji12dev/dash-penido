import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const quickFilters = ["Hoje", "Últimos 7 dias", "Últimos 30 dias", "Personalizado"];

interface DateFilterProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (d: Date) => void;
  onEndDateChange: (d: Date) => void;
}

const DateFilter = ({ startDate, endDate, onStartDateChange, onEndDateChange }: DateFilterProps) => {
  const [activeFilter, setActiveFilter] = useState("Últimos 30 dias");

  const handleQuickFilter = (filter: string) => {
    setActiveFilter(filter);
    const today = new Date();
    switch (filter) {
      case "Hoje":
        onStartDateChange(startOfDay(today));
        onEndDateChange(endOfDay(today));
        break;
      case "Últimos 7 dias":
        onStartDateChange(startOfDay(subDays(today, 7)));
        onEndDateChange(endOfDay(today));
        break;
      case "Últimos 30 dias":
        onStartDateChange(startOfDay(subDays(today, 30)));
        onEndDateChange(endOfDay(today));
        break;
      case "Personalizado":
        // keep current dates, user picks manually
        break;
    }
  };

  const handleManualDate = (setter: (d: Date) => void) => (d: Date | undefined) => {
    if (d) {
      setActiveFilter("Personalizado");
      setter(d);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 mr-2">
        {quickFilters.map((filter) => (
          <button
            key={filter}
            onClick={() => handleQuickFilter(filter)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeFilter === filter
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 bg-secondary border-border text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(startDate, "dd MMM yyyy", { locale: ptBR })}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={startDate}
              onSelect={handleManualDate(onStartDateChange)}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground text-sm">até</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 bg-secondary border-border text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(endDate, "dd MMM yyyy", { locale: ptBR })}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              mode="single"
              selected={endDate}
              onSelect={handleManualDate(onEndDateChange)}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default DateFilter;
