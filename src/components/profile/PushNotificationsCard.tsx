import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing, Check, Loader2, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  getCurrentSubscription,
  getPushSupport,
  isIos,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupport,
} from "@/lib/push";

interface Props {
  userId: string;
}

// Card do Perfil que liga/desliga as notificacoes push neste aparelho.
const PushNotificationsCard = ({ userId }: Props) => {
  const [support, setSupport] = useState<PushSupport>({ ok: true });
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const s = getPushSupport();
    setSupport(s);
    if (!s.ok) {
      setChecking(false);
      return;
    }
    getCurrentSubscription()
      .then((sub) => setEnabled(!!sub && Notification.permission === "granted"))
      .finally(() => setChecking(false));
  }, []);

  const handleEnable = async () => {
    setWorking(true);
    const { error } = await subscribeToPush(userId);
    setWorking(false);
    if (error) {
      toast.error(error);
      return;
    }
    setEnabled(true);
    toast.success("Notificações ativadas neste aparelho!");
  };

  const handleDisable = async () => {
    setWorking(true);
    const { error } = await unsubscribeFromPush();
    setWorking(false);
    if (error) {
      toast.error("Erro ao desativar: " + error);
      return;
    }
    setEnabled(false);
    toast.success("Notificações desativadas neste aparelho.");
  };

  const handleTest = async () => {
    setTesting(true);
    toast.info("Saia do painel ou bloqueie a tela: o teste chega em cerca de 8 segundos.");
    const { error, sent, agendado } = await sendTestPush();
    setTesting(false);
    if (agendado) toast.success("Teste agendado. A notificação deve aparecer em instantes.");
    else if (error) toast.error("Teste falhou: " + error);
    else if (sent === 0) toast.error("Nenhum aparelho recebeu. Tente desativar e ativar de novo.");
    else toast.success("Teste enviado. A notificação deve aparecer em instantes.");
  };

  const reason = support.ok === false ? support.reason : null;

  const description = (() => {
    if (!reason) {
      return enabled
        ? "Este aparelho recebe aviso de lead novo, agendamento marcado para você e venda paga, mesmo com o painel fechado."
        : "Receba aviso de lead novo, agendamento marcado para você e venda paga, mesmo com o painel fechado.";
    }
    switch (reason) {
      case "ios-not-installed":
        return "No iPhone as notificações só funcionam com o painel instalado na Tela de Início.";
      case "no-key":
        return "Notificações ainda não configuradas neste ambiente.";
      case "insecure":
        return "Notificações exigem HTTPS.";
      default:
        return isIos()
          ? "Este iPhone precisa do iOS 16.4 ou mais novo para receber notificações. Atualize em Ajustes > Geral > Atualização de Software."
          : "Este navegador não suporta notificações push.";
    }
  })();

  return (
    <div className="glass-card gradient-border p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Notificações no celular</h2>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>

      {reason === "ios-not-installed" && (
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
          <li className="flex items-center gap-1.5">
            Abra este painel no Safari e toque em <Share className="h-3.5 w-3.5 inline" /> Compartilhar.
          </li>
          <li className="flex items-center gap-1.5">
            Toque em <Smartphone className="h-3.5 w-3.5 inline" /> "Adicionar à Tela de Início".
          </li>
          <li>Abra o painel pelo ícone novo e volte aqui para ativar.</li>
        </ol>
      )}

      {support.ok && (
        <div className="flex flex-wrap items-center gap-2">
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : enabled ? (
            <>
              <div className="flex items-center gap-2 text-emerald-500">
                <Check className="h-4 w-4" />
                <span className="text-xs font-medium">Ativas neste aparelho</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BellRing className="h-4 w-4 mr-1" />}
                  Enviar teste
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDisable}
                  disabled={working}
                >
                  {working ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
                  Desativar
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" onClick={handleEnable} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bell className="h-4 w-4 mr-1" />}
              Ativar neste aparelho
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default PushNotificationsCard;
