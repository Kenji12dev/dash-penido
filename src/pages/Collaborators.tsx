import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useSales } from "@/context/SalesContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Plus, Save, Loader2, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Collaborator {
  id: string;
  name: string;
  type: string;
  commission_rate: number;
  fixed_salary: number;
  user_id: string | null;
}

const formatPercent = (rate: number) => `${(rate * 100).toFixed(0)}%`;
const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Collaborators = () => {
  const { user } = useAuth();
  const { sales } = useSales();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editCollab, setEditCollab] = useState<Collaborator | null>(null);
  const [editRate, setEditRate] = useState("");

  // Add user dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("colaborador");
  const [addLoading, setAddLoading] = useState(false);

  // Add collaborator dialog
  const [addCollabOpen, setAddCollabOpen] = useState(false);
  const [newCollabName, setNewCollabName] = useState("");
  const [newCollabType, setNewCollabType] = useState<string>("closer");
  const [newCollabRate, setNewCollabRate] = useState("");
  const [addCollabLoading, setAddCollabLoading] = useState(false);

  const fetchCollaborators = async () => {
    const { data, error } = await supabase
      .from("collaborators")
      .select("*")
      .order("type")
      .order("name");
    if (!error && data) {
      setCollaborators(data as Collaborator[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCollaborators();
  }, []);

  const handleEditSave = async () => {
    if (!editCollab) return;
    const rate = parseFloat(editRate) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      toast.error("Taxa inválida (0-100%)");
      return;
    }
    const { error } = await supabase
      .from("collaborators")
      .update({ commission_rate: rate })
      .eq("id", editCollab.id);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      toast.success("Taxa atualizada!");
      setEditCollab(null);
      fetchCollaborators();
    }
  };

  const handleAddUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setAddLoading(true);
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email: newEmail, password: newPassword, displayName: newName, role: newRole },
    });
    setAddLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao criar usuário");
    } else {
      toast.success("Usuário criado com sucesso!");
      setAddOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("colaborador");
    }
  };

  const handleAddCollab = async () => {
    if (!newCollabName || !newCollabType) {
      toast.error("Preencha todos os campos.");
      return;
    }
    const rate = parseFloat(newCollabRate) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      toast.error("Taxa inválida (0-100%)");
      return;
    }
    setAddCollabLoading(true);
    const { error } = await supabase
      .from("collaborators")
      .insert({ name: newCollabName.trim(), type: newCollabType, commission_rate: rate });
    setAddCollabLoading(false);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Colaborador adicionado!");
      setAddCollabOpen(false);
      setNewCollabName("");
      setNewCollabType("closer");
      setNewCollabRate("");
      fetchCollaborators();
    }
  };

  // Performance metrics per collaborator
  const getPerformance = (name: string, type: string) => {
    const paidSales = sales.filter(
      (s) => s.status === "Pago" && (type === "closer" ? s.closer === name : s.sdr === name)
    );
    const totalSales = paidSales.length;
    const totalRevenue = paidSales.reduce((sum, s) => sum + s.netValue, 0);
    const caixaGerado = paidSales.reduce((sum, s) => {
      const entry = s.downPayment && s.downPayment > 0 ? s.downPayment : s.grossValue;
      return sum + entry;
    }, 0);
    return { totalSales, totalRevenue, caixaGerado };
  };

  const closers = collaborators.filter((c) => c.type === "closer");
  const sdrs = collaborators.filter((c) => c.type === "sdr");

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-[1200px] mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Gerenciar Colaboradores
            </h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setAddCollabOpen(true)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Novo Colaborador
            </Button>
            <Button onClick={() => setAddOpen(true)} size="sm">
              <UserPlus className="h-4 w-4 mr-1" />
              Criar Usuário
            </Button>
          </div>
        </div>

        {/* Closers */}
        <div className="glass-card gradient-border p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Closers</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Fixo</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Vendas (Pago)</TableHead>
                  <TableHead>Caixa Gerado</TableHead>
                  <TableHead>Receita Líquida</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closers.map((c) => {
                  const perf = getPerformance(c.name, c.type);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.fixed_salary > 0 ? formatCurrency(c.fixed_salary) : "—"}</TableCell>
                      <TableCell>{formatPercent(c.commission_rate)}</TableCell>
                      <TableCell>{perf.totalSales}</TableCell>
                      <TableCell>{formatCurrency(perf.caixaGerado)}</TableCell>
                      <TableCell>{formatCurrency(perf.totalRevenue)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditCollab(c);
                            setEditRate(String(c.commission_rate * 100));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* SDRs */}
        <div className="glass-card gradient-border p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">SDRs</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Fixo</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Vendas (Pago)</TableHead>
                <TableHead>Caixa Gerado</TableHead>
                <TableHead>Receita Líquida</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sdrs.map((c) => {
                const perf = getPerformance(c.name, c.type);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.fixed_salary > 0 ? formatCurrency(c.fixed_salary) : "—"}</TableCell>
                    <TableCell>{formatPercent(c.commission_rate)}</TableCell>
                    <TableCell>{perf.totalSales}</TableCell>
                    <TableCell>{formatCurrency(perf.caixaGerado)}</TableCell>
                    <TableCell>{formatCurrency(perf.totalRevenue)}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditCollab(c);
                          setEditRate(String(c.commission_rate * 100));
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit commission dialog */}
      <Dialog open={!!editCollab} onOpenChange={(open) => !open && setEditCollab(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar Comissão</DialogTitle>
            <DialogDescription>{editCollab?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Taxa de Comissão (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
              />
            </div>
            <Button onClick={handleEditSave} className="w-full">
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>O usuário receberá acesso ao sistema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Tipo de Acesso</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddUser} disabled={addLoading} className="w-full">
              {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-1" /> Criar Usuário</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add collaborator dialog */}
      <Dialog open={addCollabOpen} onOpenChange={setAddCollabOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Colaborador</DialogTitle>
            <DialogDescription>Adicione um closer ou SDR ao sistema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Nome</Label>
              <Input value={newCollabName} onChange={(e) => setNewCollabName(e.target.value)} placeholder="Nome do colaborador" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Tipo</Label>
              <Select value={newCollabType} onValueChange={setNewCollabType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Comissão (%)</Label>
              <Input type="number" min="0" max="100" value={newCollabRate} onChange={(e) => setNewCollabRate(e.target.value)} placeholder="Ex: 5" />
            </div>
            <Button onClick={handleAddCollab} disabled={addCollabLoading} className="w-full">
              {addCollabLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Adicionar</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Collaborators;
