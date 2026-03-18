import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Send, Loader2, X, Trash2, Flame, Thermometer, Snowflake } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AnalysisMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  images?: string[];
  classification?: string;
  timestamp: Date;
}

interface HistoryItem {
  id: string;
  analysis: string;
  classification: string;
  images_count: number;
  created_at: string;
}

const classificationConfig: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  Quente: { icon: Flame, color: "bg-red-500/15 text-red-400 border-red-500/30", label: "Quente" },
  Morno: { icon: Thermometer, color: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Morno" },
  Frio: { icon: Snowflake, color: "bg-sky-500/15 text-sky-400 border-sky-500/30", label: "Frio" },
};

const AIAnalysis = () => {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<AnalysisMessage[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadHistory();
    loadChatMessages();
  }, []);

  const loadChatMessages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sdr_chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(
        data.map((m: any) => ({
          id: m.id,
          type: m.type as "user" | "assistant",
          content: m.content,
          images: m.images || [],
          classification: m.classification || undefined,
          timestamp: new Date(m.created_at),
        }))
      );
    }
  };

  const saveChatMessage = async (msg: AnalysisMessage) => {
    if (!user) return;
    await supabase.from("sdr_chat_messages").insert({
      id: msg.id,
      user_id: user.id,
      type: msg.type,
      content: msg.content,
      images: msg.images || [],
      classification: msg.classification || null,
    });
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from("sdr_analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data as HistoryItem[]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      toast.error("Máximo de 5 imagens por vez");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const invalidFiles = files.filter((f) => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error("Apenas JPG, PNG e WEBP são aceitos");
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setImages((prev) => [...prev, base64]);
        setPreviews((prev) => [...prev, URL.createObjectURL(file)]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (images.length === 0) {
      toast.error("Envie pelo menos uma imagem para análise");
      return;
    }

    const userMsg: AnalysisMessage = {
      id: crypto.randomUUID(),
      type: "user",
      content: input || "Analise estes prints de abordagem no Instagram",
      images: previews,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    saveChatMessage(userMsg);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-sdr-coach", {
        body: { images, message: input },
      });

      if (error) {
        let errorCode = "";
        let httpStatus = 0;
        try {
          const ctx = error?.context;
          if (ctx instanceof Response) {
            httpStatus = ctx.status;
            const body = await ctx.json();
            errorCode = body?.error || "";
          }
        } catch {}

        if (errorCode === "credit_balance_low" || httpStatus === 402) {
          throw new Error("Saldo de créditos insuficiente. Contate o administrador.");
        } else if (httpStatus === 401) {
          throw new Error("Sessão expirada. Faça login novamente.");
        } else if (httpStatus === 429 || errorCode === "rate_limit") {
          throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
        } else {
          throw new Error("Erro ao processar análise. Tente novamente em instantes.");
        }
      }

      if (data?.error) {
        if (data.error === "credit_balance_low") {
          throw new Error("Saldo de créditos insuficiente. Contate o administrador.");
        }
        throw new Error("Erro ao processar análise. Tente novamente em instantes.");
      }

      const assistantMsg: AnalysisMessage = {
        id: crypto.randomUUID(),
        type: "assistant",
        content: data.analysis,
        classification: data.classification,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      saveChatMessage(assistantMsg);
      loadHistory();
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error(err?.message || "Erro ao processar análise. Tente novamente em instantes.");
    } finally {
      setLoading(false);
      setInput("");
      setImages([]);
      setPreviews([]);
    }
  };

  const ClassificationBadge = ({ classification }: { classification: string }) => {
    const config = classificationConfig[classification] || classificationConfig.Morno;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análise IA</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Envie prints de abordagens no Instagram para receber coaching em tempo real
            </p>
          </div>
          <div className="flex gap-2">
            {!showHistory && messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!user) return;
                  await supabase.from("sdr_chat_messages").delete().eq("user_id", user.id);
                  setMessages([]);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Chat" : "Histórico"}
            </Button>
          </div>
        </div>

        {showHistory ? (
          /* History */
          <div className="space-y-3">
            {history.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Nenhuma análise realizada ainda
              </Card>
            ) : (
              history.map((item) => (
                <Card key={item.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClassificationBadge classification={item.classification} />
                      <span className="text-xs text-muted-foreground">
                        {item.images_count} {item.images_count === 1 ? "imagem" : "imagens"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground/90">
                    <ReactMarkdown>{item.analysis}</ReactMarkdown>
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : (
          /* Chat */
          <div className="flex flex-col" style={{ height: "calc(100vh - 260px)" }}>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                      <ImagePlus className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      Envie prints de conversas do Instagram para receber uma análise detalhada da sua abordagem
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <Card
                    className={`max-w-[85%] p-4 ${
                      msg.type === "user"
                        ? "bg-primary/10 border-primary/20"
                        : "bg-card border-border"
                    }`}
                  >
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {msg.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt={`Print ${i + 1}`}
                            className="h-24 w-auto rounded-lg object-cover border border-border"
                          />
                        ))}
                      </div>
                    )}
                    {msg.type === "user" && (
                      <p className="text-sm text-foreground/90">{msg.content}</p>
                    )}
                    {msg.type === "assistant" && (
                      <div className="space-y-3">
                        {msg.classification && (
                          <ClassificationBadge classification={msg.classification} />
                        )}
                        <div className="prose prose-sm prose-invert max-w-none text-foreground/90">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <Card className="p-4 bg-card border-border">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Analisando abordagem...</span>
                    </div>
                  </Card>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Image previews */}
            {previews.length > 0 && (
              <div className="flex gap-2 py-2 flex-wrap">
                {previews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={src}
                      alt={`Preview ${i + 1}`}
                      className="h-16 w-16 rounded-lg object-cover border border-border"
                    />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="flex items-end gap-2 pt-2 border-t border-border">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || images.length >= 5}
                className="shrink-0"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Contexto adicional (opcional)..."
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={handleSend}
                disabled={loading || images.length === 0}
                size="icon"
                className="shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalysis;
