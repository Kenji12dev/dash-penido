import { useEffect, useState, useCallback } from "react";
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
import { Users, Plus, Save, Loader2, Pencil, UserPlus, Trash2, CalendarDays, Check, ExternalLink, KeyRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CollaboratorCard from "@/components/dashboard/CollaboratorCard";
import { toast } from "sonner";

interface Collaborator {
  id: string;
  name: string;
  type: string;
  commission_rate: number;
  fixed_salary: number;
  user_id: string | null;
  has_calendar?: boolean;
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
  const [editFixedSalary, setEditFixedSalary] = useState("");

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
  const [newCollabFixedSalary, setNewCollabFixedSalary] = useState("");
  const [addCollabLoading, setAddCollabLoading] = useState(false);

  // Delete confirmation
  const [deleteCollab, setDeleteCollab] = useState<Collaborator | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Change password dialog
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState("");
  const [passwordNewValue, setPasswordNewValue] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [usersList, setUsersList] = useState<{ id: string; email: string; display_name: string }[]>([]);

  // Google Calendar linking
  const [calendarLinked, setCalendarLinked] = useState<Set<string>>(new Set());
  const [calendarLinking, setCalendarLinking] = useState<string | null>(null);

  const fetchCollaborators = async () => {
    const { data, error } = await supabase
      .from("collaborators")
      .select("*")
      .order("type")
      .order("name");
    if (!error && data) {
      setCollaborators(data as Collaborator[]);
    }

    // Check which collaborators have Google Calendar linked
    const { data: tokens } = await supabase
      .from("google_calendar_tokens")
      .select("collaborator_id");
    if (tokens) {
      setCalendarLinked(new Set(tokens.map((t: any) => t.collaborator_id)));
    }

    setLoading(false);
  };

  // Handle OAuth callback from Google
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state"); // collaborator_id
    if (code && state) {
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
      // Exchange code for tokens
      (async () => {
        setCalendarLinking(state);
        const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
          body: {
            action: "exchange_code",
            code,
            redirect_uri: window.location.origin + "/collaborators",
            collaborator_id: state,
          },
        });
        setCalendarLinking(null);
        if (data?.success) {
          toast.success("Google Calendar vinculado com sucesso! 📅");
          fetchCollaborators();
        } else {
          toast.error("Erro ao vincular: " + (data?.error || error?.message));
        }
      })();
    }
  }, []);

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
    const salary = parseFloat(editFixedSalary) || 0;
    if (salary < 0) {
      toast.error("Salário fixo inválido");
      return;
    }
    const { error } = await supabase
      .from("collaborators")
      .update({ commission_rate: rate, fixed_salary: salary })
      .eq("id", editCollab.id);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      toast.success("Dados atualizados!");
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
      .insert({ name: newCollabName.trim(), type: newCollabType, commission_rate: rate, fixed_salary: parseFloat(newCollabFixedSalary) || 0 });
    setAddCollabLoading(false);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Colaborador adicionado!");
      setAddCollabOpen(false);
      setNewCollabName("");
      setNewCollabType("closer");
      setNewCollabRate("");
      setNewCollabFixedSalary("");
      fetchCollaborators();
    }
  };

  const handleDeleteCollab = async () => {
    if (!deleteCollab) return;
    setDeleteLoading(true);
    const { error } = await supabase
      .from("collaborators")
      .delete()
      .eq("id", deleteCollab.id);
    setDeleteLoading(false);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Colaborador excluído!");
      setDeleteCollab(null);
      fetchCollaborators();
    }
  };

  const handleLinkCalendar = async (collaboratorId: string) => {
    setCalendarLinking(collaboratorId);
    const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
      body: {
        action: "get_auth_url",
        redirect_uri: window.location.origin + "/collaborators",
        collaborator_id: collaboratorId,
      },
    });
    setCalendarLinking(null);
    if (data?.url) {
      window.location.href = data.url;
    } else {
      toast.error("Erro ao gerar link de autorização: " + (data?.error || error?.message));
    }
  };
  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("user_id, email, display_name");
    if (data) {
      setUsersList(data.map((p) => ({ id: p.user_id, email: p.email || "", display_name: p.display_name })));
    }
  };

  const handleChangePassword = async () => {
    if (!passwordUserId || !passwordNewValue) {
      toast.error("Selecione o usuário e informe a nova senha.");
      return;
    }
    if (passwordNewValue.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setPasswordLoading(true);
    const { data, error } = await supabase.functions.invoke("change-user-password", {
      body: { user_id: passwordUserId, new_password: passwordNewValue },
    });
    setPasswordLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao alterar senha");
    } else {
      toast.success("Senha alterada com sucesso!");
      setPasswordOpen(false);
      setPasswordUserId("");
      setPasswordNewValue("");
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
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-10">
      <div className="max-w-[1200px] mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Gerenciar Colaboradores
            </h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setAddCollabOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Novo Colaborador
            </Button>
            <Button onClick={() => { setPasswordOpen(true); fetchUsers(); }} size="sm" variant="outline" className="w-full sm:w-auto">
              <KeyRound className="h-4 w-4 mr-1" />
              Alterar Senha
            </Button>
            <Button onClick={() => setAddOpen(true)} size="sm" className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4 mr-1" />
              Criar Usuário
            </Button>
          </div>
        </div>

        {/* Closers */}
        <div className="glass-card gradient-border p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Closers</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {closers.map((c) => {
                  const perf = getPerformance(c.name, c.type);
                  return (
                    <CollaboratorCard
                      key={c.id}
                      name={c.name}
                      fixedSalary={c.fixed_salary}
                      commissionRate={c.commission_rate}
                      totalSales={perf.totalSales}
                      caixaGerado={perf.caixaGerado}
                      totalRevenue={perf.totalRevenue}
                      onEdit={() => {
                        setEditCollab(c);
                        setEditRate(String(c.commission_rate * 100));
                        setEditFixedSalary(String(c.fixed_salary));
                      }}
                      onDelete={() => setDeleteCollab(c)}
                    />
                  );
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Fixo</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Vendas (Pago)</TableHead>
                      <TableHead>Caixa Gerado</TableHead>
                      <TableHead>Receita Líquida</TableHead>
                      <TableHead className="w-[140px]">Ações</TableHead>
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
                            <div className="flex items-center gap-1">
                              {calendarLinked.has(c.id) ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-emerald-500"
                                  title="Google Calendar vinculado"
                                  disabled
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-blue-500 hover:text-blue-600"
                                  title="Vincular Google Calendar"
                                  onClick={() => handleLinkCalendar(c.id)}
                                  disabled={calendarLinking === c.id}
                                >
                                  {calendarLinking === c.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CalendarDays className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditCollab(c);
                                  setEditRate(String(c.commission_rate * 100));
                                  setEditFixedSalary(String(c.fixed_salary));
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteCollab(c)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* SDRs */}
        <div className="glass-card gradient-border p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">SDRs</h2>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {sdrs.map((c) => {
              const perf = getPerformance(c.name, c.type);
              return (
                <CollaboratorCard
                  key={c.id}
                  name={c.name}
                  fixedSalary={c.fixed_salary}
                  commissionRate={c.commission_rate}
                  totalSales={perf.totalSales}
                  caixaGerado={perf.caixaGerado}
                  totalRevenue={perf.totalRevenue}
                  onEdit={() => {
                    setEditCollab(c);
                    setEditRate(String(c.commission_rate * 100));
                    setEditFixedSalary(String(c.fixed_salary));
                  }}
                  onDelete={() => setDeleteCollab(c)}
                />
              );
            })}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Fixo</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Vendas (Pago)</TableHead>
                  <TableHead>Caixa Gerado</TableHead>
                  <TableHead>Receita Líquida</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
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
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditCollab(c);
                              setEditRate(String(c.commission_rate * 100));
                              setEditFixedSalary(String(c.fixed_salary));
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteCollab(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Edit collaborator dialog */}
      <Dialog open={!!editCollab} onOpenChange={(open) => !open && setEditCollab(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
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
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Salário Fixo (R$)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={editFixedSalary}
                onChange={(e) => setEditFixedSalary(e.target.value)}
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
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Salário Fixo (R$)</Label>
              <Input type="number" min="0" step="100" value={newCollabFixedSalary} onChange={(e) => setNewCollabFixedSalary(e.target.value)} placeholder="Ex: 2000" />
            </div>
            <Button onClick={handleAddCollab} disabled={addCollabLoading} className="w-full">
              {addCollabLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Adicionar</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteCollab} onOpenChange={(open) => !open && setDeleteCollab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteCollab?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCollab}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change password dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Selecione o usuário e defina a nova senha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Usuário</Label>
              <Select value={passwordUserId} onValueChange={setPasswordUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
                <SelectContent>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Nova Senha</Label>
              <Input
                type="password"
                value={passwordNewValue}
                onChange={(e) => setPasswordNewValue(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={passwordLoading} className="w-full">
              {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4 mr-1" /> Alterar Senha</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Collaborators;
