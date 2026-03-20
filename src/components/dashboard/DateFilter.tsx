import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const quickFilters = ["Hoje", "7d", "Mês", "Custom"];
const quickLabels: Record<string, string> = {
  "Hoje": "Hoje",
  "7d": "7 dias",
  "Mês": "Mês atual",
  "Custom": "Custom",
};

interface DateFilterProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (d: Date) => void;
  onEndDateChange: (d: Date) => void;
}

const DateFilter = ({ startDate, endDate, onStartDateChange, onEndDateChange }: DateFilterProps) => {
  const [activeFilter, setActiveFilter] = useState("Mês");

  const handleQuickFilter = (filter: string) => {
    setActiveFilter(filter);
    const today = new Date();
    switch (filter) {
      case "Hoje":
        onStartDateChange(startOfDay(today));
        onEndDateChange(endOfDay(today));
        break;
      case "7d":
        onStartDateChange(startOfDay(subDays(today, 7)));
        onEndDateChange(endOfDay(today));
        break;
      case "Mês":
        onStartDateChange(startOfMonth(today));
        onEndDateChange(endOfDay(today));
        break;
      case "Custom":
        break;
    }
  };

  const handleManualDate = (setter: (d: Date) => void) => (d: Date | undefined) => {
    if (d) {
      setActiveFilter("Custom");
      setter(d);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-1.5 bg-secondary border-border text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {format(startDate, "dd/MM/yy", { locale: ptBR })}
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

      <span className="text-muted-foreground text-xs">até</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-1.5 bg-secondary border-border text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {format(endDate, "dd/MM/yy", { locale: ptBR })}
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
  );
};

export default DateFilter;
