import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AppNav from "@/components/dashboard/AppNav";
import Dashboard from "@/pages/Dashboard";
import SalesDatabase from "@/pages/SalesDatabase";
import KanbanBoard from "@/pages/KanbanBoard";
import Collaborators from "@/pages/Collaborators";
import PreSales from "@/pages/PreSales";
import Profile from "@/pages/Profile";
import Agenda from "@/pages/Agenda";
import AIAnalysis from "@/pages/AIAnalysis";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { role } = useAuth();

  const isViewer = role === "visualizador";

  return (
    <div className="min-h-screen bg-background">
      <AppNav activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "dashboard" && <Dashboard onGoToKanban={() => setActiveTab("kanban")} />}
      {activeTab === "kanban" && <KanbanBoard />}
      {activeTab === "database" && <SalesDatabase />}
      {activeTab === "pre-sales" && <PreSales />}
      {activeTab === "agenda" && <Agenda />}
      {activeTab === "ai-analysis" && <AIAnalysis />}
      {activeTab === "collaborators" && role === "admin" && <Collaborators />}
      {activeTab === "profile" && !isViewer && <Profile />}
    </div>
  );
};

export default Index;
