import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppNav from "@/components/dashboard/AppNav";
import Dashboard from "@/pages/Dashboard";
import SalesDatabase from "@/pages/SalesDatabase";
import KanbanBoard from "@/pages/KanbanBoard";
import Collaborators from "@/pages/Collaborators";
import PreSales from "@/pages/PreSales";
import Profile from "@/pages/Profile";
import Agenda from "@/pages/Agenda";
import AIAnalysis from "@/pages/AIAnalysis";
import Leads from "@/pages/Leads";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { role, user } = useAuth();
  const [overdueLeadsCount, setOverdueLeadsCount] = useState(0);

  const isViewer = role === "visualizador";

  // Fetch overdue leads count for badge
  useEffect(() => {
    if (!user) return;
    const fetchOverdue = async () => {
      // Get collaborator id for current user
      const { data: collab } = await supabase
        .from("collaborators")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const { data: leads } = await supabase
        .from("sdr_leads")
        .select("id, follow_up_date, status, sdr_id")
        .not("follow_up_date", "is", null);

      if (!leads) { setOverdueLeadsCount(0); return; }

      const now = new Date();
      const count = leads.filter((l: any) => {
      if (["Agendado", "Descartado"].includes(l.status)) return false;
        if (new Date(l.follow_up_date) >= now) return false;
        if (role !== "admin" && l.sdr_id !== collab?.id) return false;
        return true;
      }).length;
      setOverdueLeadsCount(count);
    };
    fetchOverdue();

    const channel = supabase
      .channel("leads_badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "sdr_leads" }, () => fetchOverdue())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role]);

  return (
    <div className="min-h-screen bg-background">
      <AppNav activeTab={activeTab} onTabChange={setActiveTab} overdueLeadsCount={overdueLeadsCount} />
      {activeTab === "dashboard" && <Dashboard onGoToKanban={() => setActiveTab("kanban")} />}
      {activeTab === "kanban" && <KanbanBoard />}
      {activeTab === "database" && <SalesDatabase />}
      {activeTab === "pre-sales" && <PreSales />}
      {activeTab === "agenda" && <Agenda />}
      {activeTab === "leads" && <Leads />}
      {activeTab === "ai-analysis" && (role === "admin" || role === "colaborador") && <AIAnalysis />}
      {activeTab === "collaborators" && role === "admin" && <Collaborators />}
      {activeTab === "profile" && !isViewer && <Profile />}
    </div>
  );
};

export default Index;
