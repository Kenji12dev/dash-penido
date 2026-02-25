import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSeedSales } from "@/data/seedSales";
import { supabase } from "@/integrations/supabase/client";

export interface Sale {
  id: string;
  date: Date;
  clientName: string;
  product: string;
  grossValue: number;
  netValue: number;
  paymentMethod: string;
  closer: string;
  sdr: string;
  status: string;
  leadSource: string;
  downPayment?: number;
  notes: string;
}

interface SalesContextType {
  sales: Sale[];
  addSale: (sale: Omit<Sale, "id">) => void;
  updateSale: (id: string, sale: Partial<Omit<Sale, "id">>) => void;
  deleteSale: (id: string) => void;
  products: string[];
  closers: string[];
  sdrs: string[];
}

const defaultProducts = ["Mentoria 10x", "Mentoria Individual"];
const defaultClosers = ["Andre Kenji", "Joao Pedro", "Caio Alves", "Joao Vittor", "Yan Pedro"];
const defaultSdrs = ["Harumi", "Kaique"];

const SalesContext = createContext<SalesContextType | null>(null);

export const useSales = () => {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales must be used within SalesProvider");
  return ctx;
};

export const SalesProvider = ({ children }: { children: ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>(() => getSeedSales());
  const [dbClosers, setDbClosers] = useState<string[]>([]);
  const [dbSdrs, setDbSdrs] = useState<string[]>([]);

  useEffect(() => {
    const fetchCollaborators = async () => {
      const { data } = await supabase
        .from("collaborators")
        .select("name, type")
        .order("name");
      if (data) {
        setDbClosers(data.filter((c) => c.type === "closer").map((c) => c.name));
        setDbSdrs(data.filter((c) => c.type === "sdr").map((c) => c.name));
      }
    };
    fetchCollaborators();
  }, []);

  // Merge DB collaborators with defaults, removing duplicates
  const closers = Array.from(new Set([...dbClosers, ...defaultClosers]));
  const sdrs = Array.from(new Set([...dbSdrs, ...defaultSdrs]));

  const addSale = (sale: Omit<Sale, "id">) => {
    setSales((prev) => [...prev, { ...sale, id: crypto.randomUUID() }]);
  };

  const updateSale = (id: string, updates: Partial<Omit<Sale, "id">>) => {
    setSales((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteSale = (id: string) => {
    setSales((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <SalesContext.Provider
      value={{
        sales,
        addSale,
        updateSale,
        deleteSale,
        products: defaultProducts,
        closers,
        sdrs,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
};
