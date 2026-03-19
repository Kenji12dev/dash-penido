import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, AlertTriangle, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUSES = ["Abordado", "1 mensagem", "Agendado", "Descartado"] as const;
const CLASSIFICATIONS = ["Quente", "Morno", "Frio"] as const;

type LeadStatus = typeof STATUSES[number];
type LeadClassification = typeof CLASSIFICATIONS[number];

interface Lead {
  id: string;
  sdr_id: string;
  nome: string;
  instagram: string;
  status: LeadStatus;
  classificacao: LeadClassification;
  follow_up_date: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

const statusColumns: { id: LeadStatus; label: string; color: string }[] = [
  { id: "Abordado", label: "Abordado", color: "border-gray-500/60 bg-gray-500/5" },
  { id: "1 mensagem", label: "1 mensagem", color: "border-blue-500/60 bg-blue-500/5" },
  { id: "Agendado", label: "Agendado", color: "border-emerald-500/60 bg-emerald-500/5" },
  { id: "Descartado", label: "Descartado", color: "border-red-500/60 bg-red-500/5" },
];

const classColors: Record<LeadClassification, string> = {
  "Quente": "bg-red-500/15 text-red-400 border-red-500/30",
  "Morno": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Frio": "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const emptyLead = {
  nome: "",
  instagram: "",
  status: "Abordado" as LeadStatus,
  classificacao: "Morno" as LeadClassification,
  follow_up_date: "",
  observacoes: "",
};

const Leads = () => {
  const { user, role } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [collaborators, setCollaborators] = useState<{ id: string; name: string }[]>([]);
  const [myCollaboratorId, setMyCollaboratorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterSdr, setFilterSdr] = useState<string>("all");

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newLead, setNewLead] = useState(emptyLead);
  const [newLeadSdrId, setNewLeadSdrId] = useState<string>("");

  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!user) return;
    supabase.from("collaborators").select("id, name").then(({ data }) => {
      if (data) setCollaborators(data);
    });
    supabase.from("collaborators").select("id").eq("user_id", user.id).single()
      .then(({ data }) => setMyCollaboratorId(data?.id || null));
  }, [user]);

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from("sdr_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setLeads(data as unknown as Lead[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel("sdr_leads_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sdr_leads" }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const isOverdue = (lead: Lead) => {
    if (!lead.follow_up_date) return false;
    if (["Agendado", "Descartado"].includes(lead.status)) return false;
    return new Date(lead.follow_up_date) < new Date();
  };

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (filterClass !== "all") result = result.filter((l) => l.classificacao === filterClass);
    if (isAdmin && filterSdr !== "all") result = result.filter((l) => l.sdr_id === filterSdr);
    return result;
  }, [leads, filterClass, filterSdr, isAdmin]);

  const getColumnLeads = (status: LeadStatus) => {
    const col = filteredLeads.filter((l) => l.status === status);
    return col.sort((a, b) => {
      const aOver = isOverdue(a) ? 0 : 1;
      const bOver = isOverdue(b) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const handleCreate = async () => {
    const sdrId = isAdmin ? (newLeadSdrId || myCollaboratorId) : myCollaboratorId;
    if (!sdrId) { toast.error("Você precisa estar vinculado a um colaborador."); return; }
    if (!newLead.nome.trim()) { toast.error("Nome do lead é obrigatório."); return; }
    const { error } = await supabase.from("sdr_leads").insert({
      sdr_id: sdrId,
      nome: newLead.nome,
      instagram: newLead.instagram,
      status: newLead.status,
      classificacao: newLead.classificacao,
      follow_up_date: newLead.follow_up_date || null,
      observacoes: newLead.observacoes || null,
    } as any);
    if (error) { toast.error("Erro ao criar lead."); }
    else { toast.success("Lead criado!"); setNewLead(emptyLead); setNewDialogOpen(false); }
  };

  const handleUpdate = async (field: string, value: any) => {
    if (!editLead) return;
    const updated = { ...editLead, [field]: value };
    setEditLead(updated);
    const { error } = await supabase
      .from("sdr_leads")
      .update({ [field]: value, updated_at: new Date().toISOString() } as any)
      .eq("id", editLead.id);
    if (error) toast.error("Erro ao salvar.");
  };

  const handleDrop = async (targetStatus: LeadStatus) => {
    if (!draggedId) return;
    const lead = leads.find((l) => l.id === draggedId);
    if (!lead || lead.status === targetStatus) { setDraggedId(null); setDragOverColId(null); return; }
    setLeads((prev) => prev.map((l) => l.id === draggedId ? { ...l, status: targetStatus } : l));
    setDraggedId(null);
    setDragOverColId(null);
    const { error } = await supabase
      .from("sdr_leads")
      .update({ status: targetStatus, updated_at: new Date().toISOString() } as any)
      .eq("id", draggedId);
    if (error) { toast.error("Erro ao mover lead."); fetchLeads(); }
  };

  const getSdrName = (sdrId: string) => collaborators.find((c) => c.id === sdrId)?.name || "—";

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus leads do Instagram</p>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><PlusCircle className="h-4 w-4" /> Novo Lead</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Nome</Label><Input value={newLead.nome} onChange={(e) => setNewLead({ ...newLead, nome: e.target.value })} placeholder="Nome do lead" /></div>
              <div><Label>Instagram</Label><Input value={newLead.instagram} onChange={(e) => setNewLead({ ...newLead, instagram: e.target.value })} placeholder="@username" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={newLead.status} onValueChange={(v) => setNewLead({ ...newLead, status: v as LeadStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Classificação</Label>
                  <Select value={newLead.classificacao} onValueChange={(v) => setNewLead({ ...newLead, classificacao: v as LeadClassification })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Follow-up</Label><Input type="datetime-local" value={newLead.follow_up_date} onChange={(e) => setNewLead({ ...newLead, follow_up_date: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={newLead.observacoes} onChange={(e) => setNewLead({ ...newLead, observacoes: e.target.value })} placeholder="Notas sobre o lead..." /></div>
              {isAdmin && (
                <div>
                  <Label>SDR responsável</Label>
                  <Select value={filterSdr !== "all" ? filterSdr : myCollaboratorId || ""} onValueChange={(v) => setFilterSdr(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{collaborators.filter((c) => c.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleCreate} className="w-full">Criar Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Classificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={filterSdr} onValueChange={setFilterSdr}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="SDR" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os SDRs</SelectItem>
              {collaborators.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Carregando...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statusColumns.map((col) => {
            const colLeads = getColumnLeads(col.id);
            return (
              <div
                key={col.id}
                className={cn(
                  "rounded-xl border-2 p-3 min-h-[300px] transition-colors",
                  col.color,
                  dragOverColId === col.id && "ring-2 ring-primary/50 bg-primary/5"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOverColId(col.id); }}
                onDragLeave={() => setDragOverColId(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(col.id); }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">{colLeads.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colLeads.map((lead) => {
                    const overdue = isOverdue(lead);
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggedId(lead.id)}
                        onDragEnd={() => { setDraggedId(null); setDragOverColId(null); }}
                        onClick={() => { setEditLead(lead); setEditSheetOpen(true); }}
                        className={cn(
                          "rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md transition-all group",
                          draggedId === lead.id && "opacity-40 scale-95",
                          overdue && "border-destructive/50 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
                            {lead.instagram && <p className="text-xs text-muted-foreground truncate">{lead.instagram}</p>}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", classColors[lead.classificacao])}>
                                {lead.classificacao}
                              </Badge>
                              {isAdmin && <span className="text-[10px] text-muted-foreground truncate">{getSdrName(lead.sdr_id)}</span>}
                            </div>
                            {overdue && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                                <span className="text-[10px] text-destructive font-semibold">Follow-up pendente</span>
                              </div>
                            )}
                            {lead.follow_up_date && !overdue && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Follow-up: {format(new Date(lead.follow_up_date), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Lead</SheetTitle></SheetHeader>
          {editLead && (
            <div className="space-y-4 pt-4">
              <div><Label>Nome</Label><Input value={editLead.nome} onChange={(e) => handleUpdate("nome", e.target.value)} /></div>
              <div><Label>Instagram</Label><Input value={editLead.instagram} onChange={(e) => handleUpdate("instagram", e.target.value)} /></div>
              <div>
                <Label>Status</Label>
                <Select value={editLead.status} onValueChange={(v) => handleUpdate("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classificação</Label>
                <Select value={editLead.classificacao} onValueChange={(v) => handleUpdate("classificacao", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Follow-up</Label>
                <Input
                  type="datetime-local"
                  value={editLead.follow_up_date ? format(new Date(editLead.follow_up_date), "yyyy-MM-dd'T'HH:mm") : ""}
                  onChange={(e) => handleUpdate("follow_up_date", e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={editLead.observacoes || ""} onChange={(e) => handleUpdate("observacoes", e.target.value)} rows={4} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Leads;
