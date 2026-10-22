import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Check, Loader2, Save, User } from "lucide-react";
import { toast } from "sonner";
import PushNotificationsCard from "@/components/profile/PushNotificationsCard";

interface CollaboratorOption {
  id: string;
  name: string;
}

const Profile = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [collaboratorId, setCollaboratorId] = useState<string | null>(null);
  const [calendarLinked, setCalendarLinked] = useState(false);
  const [calendarLinking, setCalendarLinking] = useState(false);

  // If user has no linked collaborator, show selector
  const [allCollaborators, setAllCollaborators] = useState<CollaboratorOption[]>([]);
  const [selectedCollabId, setSelectedCollabId] = useState("");
  const [linkingCollab, setLinkingCollab] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setDisplayName(data.display_name || "");
      setEmail(data.email || user.email || "");
    } else {
      setEmail(user.email || "");
    }

    // Check collaborator link
    const { data: collab } = await supabase
      .from("collaborators")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (collab) {
      setCollaboratorId(collab.id);
      const { data: token } = await supabase
        .from("google_calendar_tokens")
        .select("id")
        .eq("collaborator_id", collab.id)
        .maybeSingle();
      setCalendarLinked(!!token);
    } else {
      // Fetch all collaborators without user_id for linking
      const { data: collabs } = await supabase
        .from("collaborators")
        .select("id, name")
        .is("user_id", null)
        .order("name");
      if (collabs) setAllCollaborators(collabs);
    }

    setLoading(false);
  };

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      window.history.replaceState({}, "", window.location.pathname);
      (async () => {
        setCalendarLinking(true);
        const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
          body: {
            action: "exchange_code",
            code,
            redirect_uri: window.location.origin + "/",
            collaborator_id: state,
          },
        });
        setCalendarLinking(false);
        if (data?.success) {
          toast.success("Google Calendar vinculado com sucesso! 📅");
          setCalendarLinked(true);
        } else {
          toast.error("Erro ao vincular: " + (data?.error || error?.message));
        }
      })();
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user || !displayName.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Perfil atualizado!");
    }
  };

  const handleLinkCollaborator = async () => {
    if (!user || !selectedCollabId) return;
    setLinkingCollab(true);
    const { error } = await supabase
      .from("collaborators")
      .update({ user_id: user.id })
      .eq("id", selectedCollabId);
    setLinkingCollab(false);
    if (error) {
      toast.error("Erro ao vincular: " + error.message);
    } else {
      toast.success("Colaborador vinculado ao seu perfil!");
      setCollaboratorId(selectedCollabId);
      setAllCollaborators([]);
    }
  };

  const handleLinkCalendar = async () => {
    if (!collaboratorId) return;
    setCalendarLinking(true);
    const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
      body: {
        action: "get_auth_url",
        redirect_uri: window.location.origin + "/",
        collaborator_id: collaboratorId,
      },
    });
    setCalendarLinking(false);
    if (data?.url) {
      window.location.href = data.url;
    } else {
      toast.error("Erro ao gerar link: " + (data?.error || error?.message));
    }
  };

  const handleUnlinkCalendar = async () => {
    if (!collaboratorId) return;
    setCalendarLinking(true);
    const { error } = await supabase
      .from("google_calendar_tokens")
      .delete()
      .eq("collaborator_id", collaboratorId);
    setCalendarLinking(false);
    if (error) {
      toast.error("Erro ao desvincular: " + error.message);
    } else {
      toast.success("Google Calendar desvinculado.");
      setCalendarLinked(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-10">
      <div className="max-w-[600px] mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground tracking-tight">Meu Perfil</h1>
        </div>

        {/* Profile Info */}
        <div className="glass-card gradient-border p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Informações</h2>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Nome</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
            <Input value={email} disabled className="opacity-60" />
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>
        </div>

        {/* Push notifications */}
        {user && <PushNotificationsCard userId={user.id} />}

        {/* Link collaborator if not linked */}
        {!collaboratorId && allCollaborators.length > 0 && (
          <div className="glass-card gradient-border p-4 sm:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Vincular Colaborador</h2>
            <p className="text-xs text-muted-foreground">
              Selecione seu nome na lista para vincular seu perfil de colaborador.
            </p>
            <div className="flex items-center gap-2">
              <Select value={selectedCollabId} onValueChange={setSelectedCollabId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione seu nome" />
                </SelectTrigger>
                <SelectContent>
                  {allCollaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleLinkCollaborator} disabled={!selectedCollabId || linkingCollab}>
                {linkingCollab ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vincular"}
              </Button>
            </div>
          </div>
        )}

        {/* Google Calendar */}
        {collaboratorId && (
          <div className="glass-card gradient-border p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Google Calendar</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {calendarLinked
                ? "Seu calendário está vinculado. Agendamentos serão criados automaticamente."
                : "Vincule seu Google Calendar para receber agendamentos automaticamente."}
            </p>
            <div className="flex items-center gap-2">
              {calendarLinked ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">Vinculado</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive ml-auto"
                    onClick={handleUnlinkCalendar}
                    disabled={calendarLinking}
                  >
                    {calendarLinking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Desvincular
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleLinkCalendar} disabled={calendarLinking}>
                  {calendarLinking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CalendarDays className="h-4 w-4 mr-1" />}
                  Vincular Calendar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
