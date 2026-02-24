import { useState } from "react";
import AppNav from "@/components/dashboard/AppNav";
import Dashboard from "@/pages/Dashboard";
import AddSale from "@/pages/AddSale";
import SalesDatabase from "@/pages/SalesDatabase";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-background">
      <AppNav activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "dashboard" && <Dashboard />}
      {activeTab === "add-sale" && <AddSale />}
      {activeTab === "database" && <SalesDatabase />}
    </div>
  );
};

export default Index;
