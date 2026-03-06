import { useState } from "react";
import { BarChart3, PlusCircle, Database, Columns3, Users, LogOut, Menu, X, UserCircle, Headset } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AppNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const AppNav = ({ activeTab, onTabChange }: AppNavProps) => {
  const { role, signOut, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "add-sale", label: "Adicionar Venda", icon: PlusCircle },
    { id: "database", label: "Banco de Dados", icon: Database },
    { id: "kanban", label: "Fluxo de Status", icon: Columns3 },
    { id: "pre-sales", label: "Pré-vendas", icon: Headset },
    ...(role === "admin"
      ? [{ id: "collaborators", label: "Colaboradores", icon: Users }]
      : []),
    { id: "profile", label: "Perfil", icon: UserCircle },
  ];

  const handleTabClick = (id: string) => {
    onTabChange(id);
    setMobileOpen(false);
  };

  return (
    <div className="border-b border-border bg-card/40 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-primary)" }}
          >
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-sm tracking-tight hidden sm:inline">Sales Performance</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
          <div className="ml-3 pl-3 border-l border-border flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden xl:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </nav>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <BarChart3 className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span className="font-bold text-foreground text-sm">Sales Performance</span>
                  </div>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => handleTabClick(id)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                        activeTab === id
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </nav>

                <div className="p-4 border-t border-border">
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
};

export default AppNav;
