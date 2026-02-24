import { createContext, useContext, useState, ReactNode } from "react";

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
  const [sales, setSales] = useState<Sale[]>([]);

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
        closers: defaultClosers,
        sdrs: defaultSdrs,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
};
