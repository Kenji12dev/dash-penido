import { useState } from "react";
import AppNav from "@/components/dashboard/AppNav";
import Dashboard from "@/pages/Dashboard";
import AddSale from "@/pages/AddSale";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-background">
      <AppNav activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "dashboard" ? <Dashboard /> : <AddSale />}
    </div>
  );
};

export default Index;
