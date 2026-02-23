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
  notes: string;
}

interface SalesContextType {
  sales: Sale[];
  addSale: (sale: Omit<Sale, "id">) => void;
  products: string[];
  closers: string[];
  sdrs: string[];
}

const defaultProducts = ["Mentoria Premium", "Curso Avançado", "Consultoria", "Software SaaS", "Plano Enterprise"];
const defaultClosers = ["Lucas Mendes", "Ana Ferreira", "Rafael Costa", "Mariana Silva", "Pedro Oliveira"];
const defaultSdrs = ["Camila Santos", "Bruno Almeida", "Julia Rocha", "Diego Martins", "Fernanda Lima"];

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

  return (
    <SalesContext.Provider
      value={{
        sales,
        addSale,
        products: defaultProducts,
        closers: defaultClosers,
        sdrs: defaultSdrs,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
};
