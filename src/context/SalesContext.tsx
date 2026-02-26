import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSeedSales } from "@/data/seedSales";
import { toast } from "sonner";

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
  addSale: (sale: Omit<Sale, "id">) => Promise<void>;
  updateSale: (id: string, sale: Partial<Omit<Sale, "id">>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  products: string[];
  closers: string[];
  sdrs: string[];
  loading: boolean;
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

// Map DB row to Sale
const mapRow = (row: any): Sale => ({
  id: row.id,
  date: new Date(row.date),
  clientName: row.client_name,
  product: row.product,
  grossValue: Number(row.gross_value),
  netValue: Number(row.net_value),
  paymentMethod: row.payment_method,
  closer: row.closer,
  sdr: row.sdr,
  status: row.status,
  leadSource: row.lead_source || "",
  downPayment: row.down_payment != null ? Number(row.down_payment) : undefined,
  notes: row.notes || "",
});

export const SalesProvider = ({ children }: { children: ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbClosers, setDbClosers] = useState<string[]>([]);
  const [dbSdrs, setDbSdrs] = useState<string[]>([]);

  const fetchSales = useCallback(async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("date", { ascending: false });
    if (error) {
      console.error("Error fetching sales:", error);
      toast.error("Erro ao carregar vendas");
      setLoading(false);
      return;
    }
    
    // If table is empty, seed it with initial data
    if (!data || data.length === 0) {
      console.log("No sales found, seeding database...");
      const seedSales = getSeedSales();
      const dbRows = seedSales.map((s) => ({
        date: s.date.toISOString(),
        client_name: s.clientName,
        product: s.product,
        gross_value: s.grossValue,
        net_value: s.netValue,
        payment_method: s.paymentMethod,
        closer: s.closer,
        sdr: s.sdr,
        status: s.status,
        lead_source: s.leadSource,
        down_payment: s.downPayment ?? null,
        notes: s.notes,
      }));

      try {
        const response = await supabase.functions.invoke("seed-sales", {
          body: { sales: dbRows },
        });
        if (response.error) {
          console.error("Seed error:", response.error);
        }
        // Re-fetch after seeding
        const { data: seededData } = await supabase
          .from("sales")
          .select("*")
          .order("date", { ascending: false });
        setSales((seededData || []).map(mapRow));
      } catch (err) {
        console.error("Seed failed:", err);
        // Fallback to local data
        setSales(seedSales);
      }
    } else {
      setSales(data.map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

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

  const closers = Array.from(new Set([...dbClosers, ...defaultClosers]));
  const sdrs = Array.from(new Set([...dbSdrs, ...defaultSdrs]));

  const addSale = async (sale: Omit<Sale, "id">) => {
    const { data, error } = await supabase
      .from("sales")
      .insert({
        date: sale.date.toISOString(),
        client_name: sale.clientName,
        product: sale.product,
        gross_value: sale.grossValue,
        net_value: sale.netValue,
        payment_method: sale.paymentMethod,
        closer: sale.closer,
        sdr: sale.sdr,
        status: sale.status,
        lead_source: sale.leadSource,
        down_payment: sale.downPayment ?? null,
        notes: sale.notes,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding sale:", error);
      toast.error("Erro ao salvar venda");
      return;
    }
    setSales((prev) => [mapRow(data), ...prev]);
  };

  const updateSale = async (id: string, updates: Partial<Omit<Sale, "id">>) => {
    const dbUpdates: Record<string, any> = {};
    if (updates.date) dbUpdates.date = updates.date.toISOString();
    if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
    if (updates.product !== undefined) dbUpdates.product = updates.product;
    if (updates.grossValue !== undefined) dbUpdates.gross_value = updates.grossValue;
    if (updates.netValue !== undefined) dbUpdates.net_value = updates.netValue;
    if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
    if (updates.closer !== undefined) dbUpdates.closer = updates.closer;
    if (updates.sdr !== undefined) dbUpdates.sdr = updates.sdr;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.leadSource !== undefined) dbUpdates.lead_source = updates.leadSource;
    if (updates.downPayment !== undefined) dbUpdates.down_payment = updates.downPayment ?? null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { error } = await supabase
      .from("sales")
      .update(dbUpdates)
      .eq("id", id);

    if (error) {
      console.error("Error updating sale:", error);
      toast.error("Erro ao atualizar venda");
      return;
    }
    setSales((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteSale = async (id: string) => {
    const { error, count } = await supabase
      .from("sales")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      console.error("Error deleting sale:", error);
      toast.error("Erro ao excluir venda");
      return;
    }
    if (count === 0) {
      toast.error("Sem permissão para excluir esta venda");
      return;
    }
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
        loading,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
};
