"use client";
// ============================================================================
// SidekickChat — asistente IA lateral estilo monday sidekick
// ============================================================================
// Chat en lenguaje natural con tool calling. El usuario escribe lo que quiere
// hacer, el LLM (Groq con fallback a Z.ai) interpreta y ejecuta tools contra
// el store.
import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import type { SidekickMessage } from "@/lib/store";
import { executeTool, type ToolExecutionContext } from "@/lib/sidekick-tools";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  Send,
  Trash2,
  Settings2,
  Bot,
  User as UserIcon,
  Wrench,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Zap,
  X,
  Lightbulb,
  Paperclip,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Skills predefinidas (estilo monday AI blocks) + quick actions
const SIDECRICK_SKILLS = [
  // ---- AI Skills (como Monday AI blocks) ----
  {
    category: "AI Skills",
    icon: "📝",
    text: "Resumir updates",
    prompt: "Resume los updates del item seleccionado en 3 puntos clave",
    skill: "summarize",
  },
  {
    category: "AI Skills",
    icon: "✨",
    text: "Mejorar texto",
    prompt: "Toma el último update del item seleccionado y mejóralo: más claro, profesional y conciso",
    skill: "improve",
  },
  {
    category: "AI Skills",
    icon: "🔍",
    text: "Extraer información",
    prompt: "Extrae la información clave del item seleccionado: fechas, montos, personas, estados",
    skill: "extract",
  },
  {
    category: "AI Skills",
    icon: "🌐",
    text: "Traducir",
    prompt: "Traduce al inglés el contenido del item seleccionado",
    skill: "translate",
  },
  {
    category: "AI Skills",
    icon: "😊",
    text: "Detectar sentimiento",
    prompt: "Analiza el sentimiento de los updates del item seleccionado (positivo, negativo, neutral)",
    skill: "sentiment",
  },
  // ---- Quick Actions (operaciones de board) ----
  {
    category: "Acciones",
    icon: "📊",
    text: "Resumir board",
    prompt: "Hazme un resumen completo del board actual",
    skill: null,
  },
  {
    category: "Acciones",
    icon: "⚠️",
    text: "Items en riesgo",
    prompt: "Muéstrame los items en riesgo",
    skill: null,
  },
  {
    category: "Acciones",
    icon: "➕",
    text: "Crear items",
    prompt: "Crea 3 items de ejemplo en el board actual",
    skill: null,
  },
  {
    category: "Acciones",
    icon: "📋",
    text: "Listar boards",
    prompt: "¿Qué boards tengo?",
    skill: null,
  },
];

export function SidekickChat() {
  const open = useAppStore((s) => s.showSidekick);
  const setOpen = useAppStore((s) => s.setShowSidekick);
  const messages = useAppStore((s) => s.sidekickMessages);
  const addMessage = useAppStore((s) => s.addSidekickMessage);
  const updateMessage = useAppStore((s) => s.updateSidekickMessage);
  const clearMessages = useAppStore((s) => s.clearSidekickMessages);
  const thinking = useAppStore((s) => s.sidekickThinking);
  const setThinking = useAppStore((s) => s.setSidekickThinking);
  const groqApiKey = useAppStore((s) => s.sidekickGroqApiKey);
  const setGroqApiKey = useAppStore((s) => s.setSidekickGroqApiKey);

  // Store actions que el agente puede invocar — FIX: incluir TODAS las acciones
  // que las tools necesitan (antes faltaban 13 → TypeError en runtime)
  const storeActions = {
    addItem: useAppStore((s) => s.addItem),
    updateItemName: useAppStore((s) => s.updateItemName),
    updateColumnValue: useAppStore((s) => s.updateColumnValue),
    deleteItem: useAppStore((s) => s.deleteItem),
    moveItem: useAppStore((s) => s.moveItem),
    addGroup: useAppStore((s) => s.addGroup),
    setActiveBoard: useAppStore((s) => s.setActiveBoard),
    selectItem: useAppStore((s) => s.selectItem),
    setSidebarView: useAppStore((s) => s.setSidebarView),
    addUpdate: useAppStore((s) => s.addUpdate),
    pushNotification: useAppStore((s) => s.pushNotification),
    // FIX: acciones que faltaban y causaban TypeError
    addFile: useAppStore((s) => s.addFile),
    deleteFile: useAppStore((s) => s.deleteFile),
    addSubitem: useAppStore((s) => s.addSubitem),
    deleteSubitem: useAppStore((s) => s.deleteSubitem),
    renameGroup: useAppStore((s) => s.renameGroup),
    deleteGroup: useAppStore((s) => s.deleteGroup),
    duplicateGroup: useAppStore((s) => s.duplicateGroup),
    duplicateItem: useAppStore((s) => s.duplicateItem),
    archiveItem: useAppStore((s) => s.archiveItem),
    addColumn: useAppStore((s) => s.addColumn),
    deleteColumn: useAppStore((s) => s.deleteColumn),
    addBoard: useAppStore((s) => s.addBoard),
    renameBoard: useAppStore((s) => s.renameBoard),
    duplicateBoard: useAppStore((s) => s.duplicateBoard),
    archiveBoard: useAppStore((s) => s.archiveBoard),
    deleteBoard: useAppStore((s) => s.deleteBoard),
    addWorkspace: useAppStore((s) => s.addWorkspace),
    renameWorkspace: useAppStore((s) => s.renameWorkspace),
    deleteWorkspace: useAppStore((s) => s.deleteWorkspace),
  };

  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Archivos adjuntos: content es data URL (base64) para imágenes/binary,
  // o texto plano para archivos de texto
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: number; mime: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contexto actual para el LLM
  const getState = useAppStore.getState;
  const currentUserId = useAppStore((s) => s.currentUserId);
  const users = useAppStore((s) => s.users);
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const workspaces = useAppStore((s) => s.workspaces);
  const allUpdates = useAppStore((s) => s.updates);
  const allFiles = useAppStore((s) => s.files);

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const selectedItem = boards
    .flatMap((b) => b.items)
    .find((i) => i.id === selectedItemId);
  const me = users.find((u) => u.id === currentUserId);
  const wsName = workspaces.find((w) => w.id === activeBoard?.workspaceId)?.name;

  // Contexto enriquecido: updates y files del item seleccionado (como Monday Sidekick)
  const selectedItemUpdates = selectedItemId
    ? allUpdates.filter((u) => u.itemId === selectedItemId)
    : [];
  const selectedItemFiles = selectedItemId
    ? allFiles.filter((f) => f.itemId === selectedItemId)
    : [];

  // Auto-scroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Ejecutar tool call contra el store
  const executeToolCall = useCallback(
    async (
      name: string,
      args: any,
      files?: any[],
      userPrompt?: string
    ): Promise<{ result: any; uiAction?: string }> => {
      const ctx: ToolExecutionContext = {
        getState: () => useAppStore.getState(),
        actions: storeActions as any,
        groqApiKey,
        attachedFiles: files,
        userPrompt,
      };
      return executeTool(name, args, ctx);
    },
    [storeActions, groqApiKey]
  );

  // Enviar mensaje al LLM y manejar tool calls en loop.
  // _depth limita las rondas de tool calls para evitar infinite loops.
  const sendToLLM = useCallback(
    async (
      currentMessages: SidekickMessage[],
      filesForTool?: { name: string; size: number; mime: string; content: string }[],
      _userPrompt?: string,
      _depth: number = 0
    ) => {
      // Safety: máximo 8 rondas de tool calls
      if (_depth >= 8) {
        const assistantMsgId = `msg-${Date.now()}`;
        addMessage({
          id: assistantMsgId,
          role: "assistant",
          content: "⚠️ Detuve la ejecución después de 8 rondas de tool calls. El modelo puede haber entrado en un loop. Intenta reformular tu pedido.",
          streaming: false,
          createdAt: new Date().toISOString(),
        });
        setThinking(false);
        return;
      }
      // Convertir a formato Groq
      const groqMessages = currentMessages
        .filter((m) => m.role !== "tool" || m.content) // skip empty tool results
        .map((m) => {
          if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
            return {
              role: "assistant" as const,
              content: m.content || null,
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            };
          }
          if (m.role === "tool") {
            return {
              role: "tool" as const,
              content: m.content,
              tool_call_id: m.toolCallId,
            };
          }
          return { role: m.role, content: m.content };
        });

      // Crear mensaje placeholder del assistant (streaming)
      const assistantMsgId = `msg-${Date.now()}`;
      const assistantMsg: SidekickMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        streaming: true,
        createdAt: new Date().toISOString(),
      };
      addMessage(assistantMsg);

      setThinking(true);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: groqMessages,
            groqApiKey: groqApiKey,
            context: {
              userName: me?.name ?? "Usuario",
              activeBoardName: activeBoard?.name,
              activeBoardId,
              selectedItemName: selectedItem?.name,
              selectedItem: selectedItemId ?? undefined,
              workspaceName: wsName,
              // Contexto enriquecido como Monday Sidekick
              selectedItemUpdates: selectedItemUpdates.map((u) => ({
                body: u.body,
                author: users.find((usr) => usr.id === u.authorId)?.name ?? "Unknown",
                createdAt: u.createdAt,
              })),
              selectedItemFiles: selectedItemFiles.map((f) => ({
                name: f.name,
                size: f.size,
                mime: f.mime,
              })),
              selectedItemColumnValues: selectedItem?.columnValues ?? [],
            },
          }),
        });

        if (!res.body) throw new Error("Sin response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accContent = "";
        let toolCalls: any[] = [];
        let backend: "groq" | "zai" | undefined;
        let model: string | undefined;
        let hasToolCalls = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const evtBlock of events) {
            const lines = evtBlock.split("\n");
            let evt = "message";
            let data = "";
            for (const ln of lines) {
              if (ln.startsWith("event:")) evt = ln.slice(6).trim();
              else if (ln.startsWith("data:")) data += ln.slice(5).trim();
            }
            try {
              const p = JSON.parse(data);
              if (evt === "delta" && p.text) {
                accContent += p.text;
                updateMessage(assistantMsgId, { content: accContent });
              } else if (evt === "tool_call") {
                toolCalls.push({
                  id: p.id,
                  name: p.name,
                  arguments: p.arguments,
                  status: "pending",
                });
                updateMessage(assistantMsgId, { toolCalls: [...toolCalls] });
              } else if (evt === "backend") {
                backend = p.backend;
                model = p.model;
                updateMessage(assistantMsgId, { backend, model });
              } else if (evt === "done") {
                hasToolCalls = p.hasToolCalls;
              } else if (evt === "error") {
                accContent += `\n\n⚠️ Error: ${p.message}`;
                updateMessage(assistantMsgId, { content: accContent });
              }
            } catch {
              /* ignore */
            }
          }
        }

        // Marcar como no-streaming
        updateMessage(assistantMsgId, {
          streaming: false,
          content: accContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        });

        // Si hubo tool calls, ejecutarlos y luego re-llamar al LLM con los resultados
        if (toolCalls.length > 0) {
          for (const tc of toolCalls) {
            // Marcar como executing
            updateMessage(assistantMsgId, {
              toolCalls: toolCalls.map((t) =>
                t.id === tc.id ? { ...t, status: "executing" } : t
              ),
            });

            // Ejecutar (async — AI Blocks llaman al LLM)
            const { result, uiAction } = await executeToolCall(tc.name, tc.arguments, filesForTool ?? [], _userPrompt);

            // Actualizar tool call con resultado
            updateMessage(assistantMsgId, {
              toolCalls: toolCalls.map((t) =>
                t.id === tc.id
                  ? {
                      ...t,
                      status: "done",
                      result,
                      uiAction,
                    }
                  : t
              ),
            });

            // Añadir mensaje de tool result para el LLM
            const toolResultMsg: SidekickMessage = {
              id: `msg-${Date.now()}-${tc.id}`,
              role: "tool",
              content: JSON.stringify(result),
              toolCallId: tc.id,
              createdAt: new Date().toISOString(),
            };
            addMessage(toolResultMsg);
          }

          // Re-llamar al LLM con los tool results
          setThinking(false);
          // Pequeña pausa para que el UI actualice
          await new Promise((r) => setTimeout(r, 300));
          const updatedMessages = [...useAppStore.getState().sidekickMessages];
          await sendToLLM(updatedMessages, filesForTool, _userPrompt, _depth + 1);
        }
      } catch (e: any) {
        updateMessage(assistantMsgId, {
          streaming: false,
          content: `⚠️ Error de conexión: ${e?.message ?? "desconocido"}`,
        });
      } finally {
        setThinking(false);
      }
    },
    [
      addMessage,
      updateMessage,
      setThinking,
      groqApiKey,
      me,
      activeBoard,
      activeBoardId,
      selectedItem,
      selectedItemId,
      wsName,
      executeToolCall,
    ]
  );

  const handleSend = async () => {
    const text = input.trim();
    const files = attachedFiles;
    if ((!text && files.length === 0) || thinking) return;

    // Si hay archivos adjuntos, incluir info en el mensaje
    let fullText = text;
    if (files.length > 0) {
      const fileNames = files.map((f) => {
        const icon = getFileIcon(f.mime, f.name);
        return `${icon} ${f.name} (${formatFileSize(f.size)})`;
      }).join("\n");
      fullText = `${text || "He adjuntado los siguientes archivos:"}\n\nArchivos adjuntos:\n${fileNames}\n\nPor favor lee los archivos adjuntos usando la herramienta read_attached_files.`;
    }

    const userMsg: SidekickMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: fullText,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput("");
    // Limpiar archivos adjuntos del state, pero pasar la lista a sendToLLM
    setAttachedFiles([]);

    const allMessages = [...useAppStore.getState().sidekickMessages];
    await sendToLLM(allMessages, files.length > 0 ? files : undefined, text || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleSaveApiKey = () => {
    setGroqApiKey(apiKeyInput.trim() || null);
    setShowSettings(false);
    setApiKeyInput("");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 flex flex-col bg-white"
      >
        <SheetHeader className="px-4 py-3 border-b border-[#E5E8EE] bg-gradient-to-r from-[#0072E5]/[0.03] to-[#A25BFF]/[0.03]">
          <SheetTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0072E5] to-[#A25BFF] flex items-center justify-center text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#323338]">Sidekick</div>
              <div className="text-[10px] text-[#676879] font-normal flex items-center gap-1">
                {groqApiKey ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00C875]" />
                    Groq conectado
                  </>
                ) : (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFC700]" />
                    Modo demo (Z.ai)
                  </>
                )}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground"
                      onClick={() => {
                        setApiKeyInput(groqApiKey ?? "");
                        setShowSettings(!showSettings);
                      }}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Configurar API key</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground"
                      onClick={() => {
                        if (window.confirm("¿Limpiar conversación?")) {
                          clearMessages();
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Limpiar chat</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Settings panel */}
        {showSettings && (
          <div className="px-4 py-3 border-b border-border bg-secondary/30 fade-in">
            <div className="text-xs font-semibold mb-1.5">
              Groq API Key (opcional)
            </div>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="gsk_..."
              className="w-full h-8 text-xs px-2 rounded border border-border bg-card font-mono"
            />
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-[#0072E5] hover:bg-[#0058B5]"
                onClick={handleSaveApiKey}
              >
                Guardar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowSettings(false)}
              >
                Cancelar
              </Button>
              <span className="text-[10px] text-muted-foreground ml-auto">
                Sin key: usa Z.ai fallback
              </span>
            </div>
          </div>
        )}

        {/* Context indicator */}
        {(activeBoard || selectedItem) && (
          <div className="px-4 py-1.5 border-b border-border bg-card text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-2.5 w-2.5 text-[#FFC700]" />
            <span className="truncate">
              Contexto: {activeBoard?.name}
              {selectedItem && ` → ${selectedItem.name}`}
            </span>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-3 bg-background"
        >
          {messages.length === 0 && (
            <div className="text-center py-6 fade-in">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0072E5] to-[#A25BFF] flex items-center justify-center text-white mx-auto mb-3 shadow-md">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold mb-1">
                ¡Hola{me ? `, ${me.name.split(" ")[0]}` : ""}! 👋
              </div>
              <div className="text-xs text-muted-foreground max-w-[280px] mx-auto mb-4">
                Soy Sidekick. Pídeme en lenguaje natural lo que quieras hacer en
                tu workspace.
              </div>
              <div className="space-y-3 text-left">
                {/* AI Skills (como Monday AI blocks) */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#0072E5]/70 px-1 mb-1.5 tracking-wider flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    AI Skills
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {SIDECRICK_SKILLS.filter((s) => s.category === "AI Skills").map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedPrompt(s.prompt)}
                        className="w-full flex items-center gap-2 p-1.5 rounded-md border border-[#0072E5]/20 hover:border-[#0072E5]/50 hover:bg-[#0072E5]/5 transition text-left group"
                      >
                        <span className="text-sm shrink-0">{s.icon}</span>
                        <span className="text-[11px] flex-1">{s.text}</span>
                        <Lightbulb className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>
                {/* Acciones rápidas */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground/70 px-1 mb-1.5 tracking-wider">
                    Acciones
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {SIDECRICK_SKILLS.filter((s) => s.category === "Acciones").map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedPrompt(s.prompt)}
                        className="flex items-center gap-1.5 p-1.5 rounded-md border border-border hover:border-[#0072E5]/40 hover:bg-secondary/50 transition text-left group"
                      >
                        <span className="text-sm shrink-0">{s.icon}</span>
                        <span className="text-[11px] flex-1 truncate">{s.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>

          {thinking && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0072E5] to-[#A25BFF] flex items-center justify-center text-white">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="flex items-center gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
              </div>
            </div>
          )}
        </div>

        {/* Input + archivos adjuntos */}
        <div className="border-t border-[#D0D4E4] p-3 bg-white">
          {/* Lista de archivos adjuntos */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#F5F6F8] border border-[#D0D4E4] text-[11px]"
                >
                  {getFileIconComponent(f.mime, f.name)}
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <span className="text-[9px] text-[#676879]">{formatFileSize(f.size)}</span>
                  <button
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-[#676879] hover:text-[#DF2F4A] transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input hidden para archivos */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,.xlsx,.xls,.csv,.docx,.doc,.pdf,.txt,.json,.md,.xml,.html,.css,.js,.ts,.py,.sql,.yaml,.yml,.sh"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const content = typeof reader.result === "string" ? reader.result : "";
                  setAttachedFiles((prev) => [
                    ...prev,
                    {
                      name: file.name,
                      size: file.size,
                      mime: file.type || guessMime(file.name),
                      content,
                    },
                  ]);
                };
                reader.onerror = () => {
                  setAttachedFiles((prev) => [
                    ...prev,
                    {
                      name: file.name,
                      size: file.size,
                      mime: file.type || "application/octet-stream",
                      content: "(no se pudo leer el archivo)",
                    },
                  ]);
                };
                // Leer todo como data URL (base64) — funciona para imágenes, excel, word, pdf, texto
                reader.readAsDataURL(file);
              });
              e.target.value = "";
            }}
          />

          <div className="relative">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={thinking}
              className="absolute left-1.5 bottom-1.5 h-7 w-7 flex items-center justify-center rounded text-[#676879] hover:text-[#0073EA] hover:bg-[rgba(103,104,121,0.1)] transition-colors disabled:opacity-50"
              title="Adjuntar archivo (imágenes, Excel, Word, PDF, CSV, texto)"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedFiles.length > 0 ? "Describe qué quieres hacer con los archivos…" : "Pídeme cualquier cosa… (Enter para enviar)"}
              className="min-h-[44px] max-h-[120px] resize-none text-sm pl-10 pr-10"
              rows={1}
              disabled={thinking}
            />
            <Button
              size="sm"
              className="absolute right-1 bottom-1 h-7 w-7 p-0 bg-[#0073EA] hover:bg-[#0058B5]"
              style={{ borderRadius: "4px" }}
              onClick={handleSend}
              disabled={(!input.trim() && attachedFiles.length === 0) || thinking}
            >
              {thinking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <div className="text-[10px] text-[#676879]/60 mt-1.5 text-center">
            📎 Sube imágenes, Excel, Word, PDF, CSV o texto · La IA los interpretará automáticamente
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// MessageBubble — renderiza un mensaje con tool calls
// ============================================================================
function MessageBubble({ msg }: { msg: SidekickMessage }) {
  const isUser = msg.role === "user";
  const isTool = msg.role === "tool";

  if (isTool) {
    // Los mensajes de tool result no se muestran directamente, solo vía el
    // tool call del assistant que los originó
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm",
          isUser
            ? "bg-foreground"
            : "bg-gradient-to-br from-[#0072E5] to-[#A25BFF]"
        )}
      >
        {isUser ? (
          <UserIcon className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </div>
      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3 py-2 text-sm max-w-[90%]",
            isUser
              ? "bg-[#0072E5] text-white"
              : "bg-card border border-border text-foreground",
            msg.streaming && "cursor-blink"
          )}
        >
          {msg.content || (msg.streaming ? "" : "…")}
        </div>

        {/* Tool calls */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5 max-w-[90%]">
            {msg.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} tc={tc} />
            ))}
          </div>
        )}

        {/* Metadata */}
        {!isUser && msg.backend && !msg.streaming && (
          <div className="text-[9px] text-muted-foreground/60 mt-1 px-1 flex items-center gap-1">
            <span
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-full",
                msg.backend === "groq" ? "bg-[#FF642E]" : "bg-[#00C875]"
              )}
            />
            {msg.backend === "groq" ? "Groq" : "Z.ai"} · {msg.model}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// ToolCallCard — muestra un tool call ejecutándose con su resultado
// ============================================================================
function ToolCallCard({
  tc,
}: {
  tc: NonNullable<SidekickMessage["toolCalls"]>[0];
}) {
  const [expanded, setExpanded] = useState(false);

  const toolLabels: Record<string, string> = {
    list_boards: "📋 Listar boards",
    get_active_board: "📊 Obtener board activo",
    get_item: "🔍 Ver item",
    search_items: "🔎 Buscar items",
    create_item: "➕ Crear item",
    create_items_batch: "➕ Crear items (batch)",
    update_column_value: "✏️ Actualizar columna",
    move_item: "🔄 Mover item",
    delete_item: "🗑️ Eliminar item",
    add_update: "💬 Añadir update",
    add_group: "📁 Crear grupo",
    navigate_to_board: "🧭 Navegar a board",
    open_item: "📂 Abrir item",
    summarize_board: "📊 Resumir board",
    find_at_risk_items: "⚠️ Encontrar items en riesgo",
  };

  const label = toolLabels[tc.name] ?? tc.name;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-secondary/50 transition text-left"
      >
        <div className="shrink-0">
          {tc.status === "executing" && (
            <Loader2 className="h-3.5 w-3.5 text-[#0072E5] animate-spin" />
          )}
          {tc.status === "done" && (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#00C875]" />
          )}
          {tc.status === "error" && (
            <AlertCircle className="h-3.5 w-3.5 text-[#E2445C]" />
          )}
          {tc.status === "pending" && (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
          )}
        </div>
        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium flex-1 truncate">{label}</span>
        {tc.status === "executing" && (
          <Badge variant="outline" className="text-[9px] h-4 px-1 text-[#0072E5] border-[#0072E5]/30">
            ejecutando
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-2.5 py-2 bg-secondary/20 space-y-1.5">
          {Object.keys(tc.arguments).length > 0 && (
            <div>
              <div className="text-[9px] uppercase font-bold text-muted-foreground/70 mb-0.5">
                Args
              </div>
              <pre className="text-[10px] font-mono whitespace-pre-wrap break-words text-foreground">
                {JSON.stringify(tc.arguments, null, 2)}
              </pre>
            </div>
          )}
          {tc.result !== undefined && (
            <div>
              <div className="text-[9px] uppercase font-bold text-muted-foreground/70 mb-0.5">
                Resultado
              </div>
              <pre
                className={cn(
                  "text-[10px] font-mono whitespace-pre-wrap break-words",
                  tc.result?.error ? "text-[#E2445C]" : "text-[#00C875]"
                )}
              >
                {JSON.stringify(tc.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SidekickButton — botón flotante estilo monday sidekick (esquina inferior derecha)
// ============================================================================
export function SidekickButton() {
  const open = useAppStore((s) => s.showSidekick);
  const setOpen = useAppStore((s) => s.setShowSidekick);

  if (open) return null; // oculto cuando el panel está abierto

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setOpen(true)}
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-[#0072E5] to-[#A25BFF] text-white shadow-lg hover:shadow-xl flex items-center justify-center group"
      title="Abrir Sidekick IA"
    >
      <Sparkles className="h-6 w-6 group-hover:scale-110 transition" />
      {/* Anillo pulsante */}
      <span className="absolute inset-0 rounded-full bg-[#0072E5] opacity-30 animate-ping" style={{ animationDuration: "2s" }} />
    </motion.button>
  );
}

// ============================================================================
// Helpers para archivos adjuntos
// ============================================================================

function getFileIcon(mime: string, name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.includes("spreadsheet") || ["xlsx", "xls", "csv"].includes(ext)) return "📊";
  if (mime.includes("word") || ["docx", "doc"].includes(ext)) return "📄";
  if (mime === "application/pdf" || ext === "pdf") return "📕";
  if (mime.startsWith("text/") || ["txt", "json", "md"].includes(ext)) return "📝";
  return "📎";
}

function getFileIconComponent(mime: string, name: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (mime.startsWith("image/")) return <ImageIcon className="h-3 w-3 text-[#0073EA]" />;
  if (mime.includes("spreadsheet") || ["xlsx", "xls", "csv"].includes(ext))
    return <FileSpreadsheet className="h-3 w-3 text-[#00C875]" />;
  if (mime.includes("word") || ["docx", "doc"].includes(ext))
    return <FileText className="h-3 w-3 text-[#0073EA]" />;
  if (mime === "application/pdf" || ext === "pdf")
    return <FileText className="h-3 w-3 text-[#DF2F4A]" />;
  if (mime.startsWith("text/")) return <FileText className="h-3 w-3 text-[#676879]" />;
  return <File className="h-3 w-3 text-[#676879]" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    pdf: "application/pdf",
    txt: "text/plain",
    json: "application/json",
    md: "text/markdown",
  };
  return map[ext] ?? "application/octet-stream";
}
