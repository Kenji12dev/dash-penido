import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AppNav from "@/components/dashboard/AppNav";
import Dashboard from "@/pages/Dashboard";


import KanbanBoard from "@/pages/KanbanBoard";
import Collaborators from "@/pages/Collaborators";
import PreSales from "@/pages/PreSales";
import Profile from "@/pages/Profile";
import Agenda from "@/pages/Agenda";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppNav activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "dashboard" && <Dashboard onGoToKanban={() => setActiveTab("kanban")} />}
      {activeTab === "kanban" && <KanbanBoard />}
      {activeTab === "pre-sales" && <PreSales />}
      {activeTab === "agenda" && <Agenda />}
      {activeTab === "collaborators" && role === "admin" && <Collaborators />}
      {activeTab === "profile" && <Profile />}
    </div>
  );
};

export default Index;
