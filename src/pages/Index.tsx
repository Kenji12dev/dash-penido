import { useState, useEffect } from "react";
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

const TABS = ["dashboard", "kanban", "database", "pre-sales", "agenda", "collaborators", "profile"];

const Index = () => {
  // ?tab=agenda abre direto na aba (usado pelo clique na notificacao push).
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab && TABS.includes(tab) ? tab : "dashboard";
  });
  const { role, user } = useAuth();

  const isViewer = role === "visualizador";

  return (
    <div className="min-h-screen bg-background">
      <AppNav activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "dashboard" && <Dashboard onGoToKanban={() => setActiveTab("kanban")} />}
      {activeTab === "kanban" && <KanbanBoard />}
      {activeTab === "database" && <SalesDatabase />}
      {activeTab === "pre-sales" && <PreSales />}
      {activeTab === "agenda" && <Agenda />}
      {activeTab === "collaborators" && role === "admin" && <Collaborators />}
      {activeTab === "profile" && !isViewer && <Profile />}
    </div>
  );
};

export default Index;
