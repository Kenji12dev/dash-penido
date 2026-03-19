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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Pencil, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUSES = ["Novo", "Em contato", "Qualificado", "Agendado", "No-show", "Descartado"] as const;
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

const statusColors: Record<LeadStatus, string> = {
  "Novo": "bg-gray-500/15 text-gray-400 border-gray-500/30",
  "Em contato": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Qualificado": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Agendado": "bg-green-500/15 text-green-400 border-green-500/30",
  "No-show": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Descartado": "bg-red-500/15 text-red-400 border-red-500/30",
};

const classColors: Record<LeadClassification, string> = {
  "Quente": "bg-red-500/15 text-red-400 border-red-500/30",
  "Morno": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Frio": "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const emptyLead = {
  nome: "",
  instagram: "",
  status: "Novo" as LeadStatus,
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

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterSdr, setFilterSdr] = useState<string>("all");

  // New lead dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newLead, setNewLead] = useState(emptyLead);

  // Edit sheet
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const isAdmin = role === "admin";

  // Fetch collaborator info for current user
  useEffect(() => {
    if (!user) return;
    supabase
      .from("collaborators")
      .select("id, name")
      .then(({ data }) => {
        if (data) setCollaborators(data);
      });
    supabase
      .from("collaborators")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => setMyCollaboratorId(data?.id || null));
  }, [user]);

  // Fetch leads
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
    if (filterStatus !== "all") result = result.filter((l) => l.status === filterStatus);
    if (filterClass !== "all") result = result.filter((l) => l.classificacao === filterClass);
    if (isAdmin && filterSdr !== "all") result = result.filter((l) => l.sdr_id === filterSdr);

    // Sort: overdue first
    return result.sort((a, b) => {
      const aOver = isOverdue(a) ? 0 : 1;
      const bOver = isOverdue(b) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [leads, filterStatus, filterClass, filterSdr, isAdmin]);

  const handleCreate = async () => {
    const sdrId = isAdmin && filterSdr !== "all" ? filterSdr : myCollaboratorId;
    if (!sdrId) {
      toast.error("Você precisa estar vinculado a um colaborador.");
      return;
    }
    if (!newLead.nome.trim()) {
      toast.error("Nome do lead é obrigatório.");
      return;
    }
    const { error } = await supabase.from("sdr_leads").insert({
      sdr_id: sdrId,
      nome: newLead.nome,
      instagram: newLead.instagram,
      status: newLead.status,
      classificacao: newLead.classificacao,
      follow_up_date: newLead.follow_up_date || null,
      observacoes: newLead.observacoes || null,
    } as any);
    if (error) {
      toast.error("Erro ao criar lead.");
    } else {
      toast.success("Lead criado!");
      setNewLead(emptyLead);
      setNewDialogOpen(false);
    }
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

  const getSdrName = (sdrId: string) => collaborators.find((c) => c.id === sdrId)?.name || "—";

  // Count overdue for badge (only own leads for SDRs)
  const overdueCount = useMemo(() => {
    return leads.filter((l) => {
      if (!isAdmin && l.sdr_id !== myCollaboratorId) return false;
      return isOverdue(l);
    }).length;
  }, [leads, myCollaboratorId, isAdmin]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus leads do Instagram</p>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" /> Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome</Label>
                <Input value={newLead.nome} onChange={(e) => setNewLead({ ...newLead, nome: e.target.value })} placeholder="Nome do lead" />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={newLead.instagram} onChange={(e) => setNewLead({ ...newLead, instagram: e.target.value })} placeholder="@username" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={newLead.status} onValueChange={(v) => setNewLead({ ...newLead, status: v as LeadStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Classificação</Label>
                  <Select value={newLead.classificacao} onValueChange={(v) => setNewLead({ ...newLead, classificacao: v as LeadClassification })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Follow-up</Label>
                <Input type="datetime-local" value={newLead.follow_up_date} onChange={(e) => setNewLead({ ...newLead, follow_up_date: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={newLead.observacoes} onChange={(e) => setNewLead({ ...newLead, observacoes: e.target.value })} placeholder="Notas sobre o lead..." />
              </div>
              {isAdmin && (
                <div>
                  <Label>SDR responsável</Label>
                  <Select value={filterSdr !== "all" ? filterSdr : myCollaboratorId || ""} onValueChange={(v) => setFilterSdr(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {collaborators.filter((c) => c.id).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleCreate} className="w-full">Criar Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
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

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground text-center py-12">Carregando...</p>
      ) : filteredLeads.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum lead encontrado.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Instagram</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Follow-up</TableHead>
                {isAdmin && <TableHead>SDR</TableHead>}
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const overdue = isOverdue(lead);
                return (
                  <TableRow key={lead.id} className={overdue ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {overdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                        <span>{lead.nome}</span>
                        {overdue && <span className="text-xs text-destructive font-semibold">Follow-up pendente</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lead.instagram || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[lead.status]}>{lead.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={classColors[lead.classificacao]}>{lead.classificacao}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.follow_up_date ? format(new Date(lead.follow_up_date), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                    </TableCell>
                    {isAdmin && <TableCell className="text-sm text-muted-foreground">{getSdrName(lead.sdr_id)}</TableCell>}
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditLead(lead); setEditSheetOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Lead</SheetTitle>
          </SheetHeader>
          {editLead && (
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nome</Label>
                <Input value={editLead.nome} onChange={(e) => handleUpdate("nome", e.target.value)} />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={editLead.instagram} onChange={(e) => handleUpdate("instagram", e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editLead.status} onValueChange={(v) => handleUpdate("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classificação</Label>
                <Select value={editLead.classificacao} onValueChange={(v) => handleUpdate("classificacao", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
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
                <Textarea
                  value={editLead.observacoes || ""}
                  onChange={(e) => handleUpdate("observacoes", e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Leads;
