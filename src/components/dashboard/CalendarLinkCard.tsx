import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { CalendarDays, Check, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";

const CalendarLinkCard = () => {
  const { user } = useAuth();
  const [collaboratorId, setCollaboratorId] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  const fetchStatus = async () => {
    if (!user) return;

    // Find collaborator linked to this user
    const { data: collab } = await supabase
      .from("collaborators")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!collab) {
      setLoading(false);
      return;
    }

    setCollaboratorId(collab.id);

    // Check if calendar is linked
    const { data: token } = await supabase
      .from("google_calendar_tokens")
      .select("id")
      .eq("collaborator_id", collab.id)
      .maybeSingle();

    setLinked(!!token);
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
        setLinking(true);
        const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
          body: {
            action: "exchange_code",
            code,
            redirect_uri: window.location.origin + "/",
            collaborator_id: state,
          },
        });
        setLinking(false);
        if (data?.success) {
          toast.success("Google Calendar vinculado com sucesso! 📅");
          setLinked(true);
        } else {
          toast.error("Erro ao vincular: " + (data?.error || error?.message));
        }
      })();
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [user]);

  const handleLink = async () => {
    if (!collaboratorId) return;
    setLinking(true);
    const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
      body: {
        action: "get_auth_url",
        redirect_uri: window.location.origin + "/",
        collaborator_id: collaboratorId,
      },
    });
    setLinking(false);
    if (data?.url) {
      window.location.href = data.url;
    } else {
      toast.error("Erro ao gerar link: " + (data?.error || error?.message));
    }
  };

  if (loading || !collaboratorId) return null;

  return (
    <div className="glass-card gradient-border p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Google Calendar</h3>
            <p className="text-xs text-muted-foreground">
              {linked
                ? "Seu calendário está vinculado. Agendamentos serão criados automaticamente."
                : "Vincule seu Google Calendar para receber agendamentos automaticamente."}
            </p>
          </div>
        </div>
        {linked ? (
          <div className="flex items-center gap-2 text-emerald-500">
            <Check className="h-4 w-4" />
            <span className="text-xs font-medium">Vinculado</span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleLink}
            disabled={linking}
          >
            {linking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CalendarDays className="h-4 w-4 mr-1" />
            )}
            Vincular Calendar
          </Button>
        )}
      </div>
    </div>
  );
};

export default CalendarLinkCard;
