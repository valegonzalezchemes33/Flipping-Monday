"use client";
// ============================================================================
// SidekickChat â€” asistente IA lateral estilo monday sidekick
// ============================================================================
// Chat en lenguaje natural con tool calling. El usuario escribe lo que quiere
// hacer, el LLM (Groq con fallback a Z.ai) interpreta y ejecuta tools contra
// el store.
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Array vacÃ­o estable â€” usado como fallback en selectores para evitar
// crear nuevas referencias en cada render y causar re-renders innecesarios.
const EMPTY_ARRAY: any[] = [];

// Contador atomico para IDs de mensajes â€” evita duplicados cuando
// React Strict Mode ejecuta efectos dos veces en el mismo milisegundo.
let _msgCounter = 0;
const nextMsgId = (prefix = "msg") => `${prefix}-${Date.now()}-${++_msgCounter}`;


// Skills predefinidas (estilo monday AI blocks) + quick actions
const SIDECRICK_SKILLS = [
  // ---- AI Skills (como Monday AI blocks) ----
  {
    category: "AI Skills",
    icon: "ðŸ“",
    text: "Resumir updates",
    prompt: "Resume los updates del item seleccionado en 3 puntos clave",
    skill: "summarize",
  },
  {
    category: "AI Skills",
    icon: "âœ¨",
    text: "Mejorar texto",
    prompt: "Toma el Ãºltimo update del item seleccionado y mejÃ³ralo: mÃ¡s claro, profesional y conciso",
    skill: "improve",
  },
  {
    category: "AI Skills",
    icon: "ðŸ”",
    text: "Extraer informaciÃ³n",
    prompt: "Extrae la informaciÃ³n clave del item seleccionado: fechas, montos, personas, estados",
    skill: "extract",
  },
  {
    category: "AI Skills",
    icon: "ðŸŒ",
    text: "Traducir",
    prompt: "Traduce al inglÃ©s el contenido del item seleccionado",
    skill: "translate",
  },
  {
    category: "AI Skills",
    icon: "ðŸ˜Š",
    text: "Detectar sentimiento",
    prompt: "Analiza el sentimiento de los updates del item seleccionado (positivo, negativo, neutral)",
    skill: "sentiment",
  },
  // ---- Quick Actions (operaciones de board) ----
  {
    category: "Acciones",
    icon: "ðŸ“Š",
    text: "Resumir board",
    prompt: "Hazme un resumen completo del board actual",
    skill: null,
  },
  {
    category: "Acciones",
    icon: "âš ï¸",
    text: "Items en riesgo",
    prompt: "MuÃ©strame los items en riesgo",
    skill: null,
  },
  {
    category: "Acciones",
    icon: "âž•",
    text: "Crear items",
    prompt: "Crea 3 items de ejemplo en el board actual",
    skill: null,
  },
  {
    category: "Acciones",
    icon: "ðŸ“‹",
    text: "Listar boards",
    prompt: "Â¿QuÃ© boards tengo?",
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
  const groqApiKeyFromSettings = useAppStore((s) => s.settings?.groqApiKey);
  const sidekickSpecificKey = useAppStore((s) => s.sidekickGroqApiKey);
  // Prioridad: key especÃ­fica del sidekick > key global de Settings
  const groqApiKey = sidekickSpecificKey || groqApiKeyFromSettings || "";
  const setGroqApiKey = useAppStore((s) => s.setSidekickGroqApiKey);
  const openGlobalSettings = useAppStore((s) => s.setShowSettings);

  // Store actions que el agente puede invocar.
  // IMPORTANTE: useMemo para que el objeto sea estable entre renders â€” sin esto,
  // cada render crea un objeto nuevo que invalida todos los useCallback que
  // dependen de storeActions (executeToolCall, sendToLLM) causando re-renders
  // en cascada. Las acciones individuales de zustand son referencias estables.
  const addItem = useAppStore((s) => s.addItem);
  const updateItemName = useAppStore((s) => s.updateItemName);
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);
  const deleteItem = useAppStore((s) => s.deleteItem);
  const moveItem = useAppStore((s) => s.moveItem);
  const addGroup = useAppStore((s) => s.addGroup);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const selectItem = useAppStore((s) => s.selectItem);
  const setSidebarView = useAppStore((s) => s.setSidebarView);
  const addUpdate = useAppStore((s) => s.addUpdate);
  const pushNotification = useAppStore((s) => s.pushNotification);
  const addFile = useAppStore((s) => s.addFile);
  const deleteFile = useAppStore((s) => s.deleteFile);
  const addSubitem = useAppStore((s) => s.addSubitem);
  const deleteSubitem = useAppStore((s) => s.deleteSubitem);
  const renameGroup = useAppStore((s) => s.renameGroup);
  const deleteGroup = useAppStore((s) => s.deleteGroup);
  const duplicateGroup = useAppStore((s) => s.duplicateGroup);
  const duplicateItem = useAppStore((s) => s.duplicateItem);
  const archiveItem = useAppStore((s) => s.archiveItem);
  const addColumn = useAppStore((s) => s.addColumn);
  const deleteColumn = useAppStore((s) => s.deleteColumn);
  const addBoard = useAppStore((s) => s.addBoard);
  const renameBoard = useAppStore((s) => s.renameBoard);
  const duplicateBoard = useAppStore((s) => s.duplicateBoard);
  const archiveBoard = useAppStore((s) => s.archiveBoard);
  const deleteBoard = useAppStore((s) => s.deleteBoard);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);

  const storeActions = useMemo(
    () => ({
      addItem, updateItemName, updateColumnValue, deleteItem, moveItem,
      addGroup, setActiveBoard, selectItem, setSidebarView, addUpdate,
      pushNotification, addFile, deleteFile, addSubitem, deleteSubitem,
      renameGroup, deleteGroup, duplicateGroup, duplicateItem, archiveItem,
      addColumn, deleteColumn, addBoard, renameBoard, duplicateBoard,
      archiveBoard, deleteBoard, addWorkspace, renameWorkspace, deleteWorkspace,
    }),
    [
      addItem, updateItemName, updateColumnValue, deleteItem, moveItem,
      addGroup, setActiveBoard, selectItem, setSidebarView, addUpdate,
      pushNotification, addFile, deleteFile, addSubitem, deleteSubitem,
      renameGroup, deleteGroup, duplicateGroup, duplicateItem, archiveItem,
      addColumn, deleteColumn, addBoard, renameBoard, duplicateBoard,
      archiveBoard, deleteBoard, addWorkspace, renameWorkspace, deleteWorkspace,
    ]
  );

  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: number; mime: string; content: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contexto actual para el LLM
  // OPTIMIZACIÃ“N: en vez de subscribirse a `s.boards` (que cambia en cualquier
  // mutaciÃ³n de cualquier item), usamos selectores mÃ¡s granulares.
  const currentUserId = useAppStore((s) => s.currentUserId);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const selectedItemId = useAppStore((s) => s.selectedItemId);

  // Solo subscribirse al board activo y al item seleccionado (no a TODO)
  const activeBoard = useAppStore((s) =>
    s.boards.find((b) => b.id === s.activeBoardId)
  );
  const selectedItem = useAppStore((s) => {
    if (!s.selectedItemId) return undefined;
    for (const b of s.boards) {
      const found = b.items.find((i) => i.id === s.selectedItemId);
      if (found) return found;
    }
    return undefined;
  });
  // Nombre del usuario actual y workspace (primitivos estables)
  const me = useAppStore((s) => s.users.find((u) => u.id === s.currentUserId));
  const wsName = useAppStore((s) => {
    const b = s.boards.find((x) => x.id === s.activeBoardId);
    if (!b) return undefined;
    return s.workspaces.find((w) => w.id === b.workspaceId)?.name;
  });

  // Updates y files del item seleccionado (solo si hay item).
  // PatrÃ³n correcto: subscribirse a los arrays originales (referencia estable)
  // y derivar con useMemo. NO usar .filter() dentro del selector de useAppStore.
  const allUpdates = useAppStore((s) => s.updates);
  const allFiles = useAppStore((s) => s.files);
  const selectedItemUpdates = useMemo(
    () =>
      selectedItemId
        ? allUpdates.filter((u) => u.itemId === selectedItemId)
        : EMPTY_ARRAY,
    [allUpdates, selectedItemId]
  );
  const selectedItemFiles = useMemo(
    () =>
      selectedItemId
        ? allFiles.filter((f) => f.itemId === selectedItemId)
        : EMPTY_ARRAY,
    [allFiles, selectedItemId]
  );
  // Lista de usuarios (solo si hay item seleccionado que lo necesite)
  const users = useAppStore((s) => s.users);

  // Auto-scroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Ejecutar tool call contra el store (async porque read_attached_files
  // puede llamar al endpoint VLM para analizar imÃ¡genes).
  // Recibe los archivos explÃ­citamente para que el loop recursivo de sendToLLM
  // mantenga el contexto aunque el state attachedFiles se limpie.
  const executeToolCall = useCallback(
    async (
      name: string,
      args: any,
      files: { name: string; size: number; mime: string; content: string }[],
      userPrompt?: string
    ): Promise<{ result: any; uiAction?: string }> => {
      const ctx: ToolExecutionContext = {
        getState: () => useAppStore.getState(),
        actions: storeActions as any,
        attachedFiles: files,
        userPrompt,
      };
      return executeTool(name, args, ctx);
    },
    [storeActions]
  );

  // Enviar mensaje al LLM y manejar tool calls en loop.
  // filesForTool y userPrompt se pasan explÃ­citamente para que el loop
  // recursivo (cuando hay tool calls) mantenga el contexto de archivos
  // adjuntos y el prompt original del usuario, aunque el state ya se haya limpiado.
  const sendToLLM = useCallback(
    async (
      currentMessages: SidekickMessage[],
      filesForTool?: { name: string; size: number; mime: string; content: string }[],
      userPrompt?: string,
      // Depth limit para evitar infinite loop si el LLM entra en loop de
      // tool_calls (ej: llama a read_attached_files, recibe error, vuelve a
      // llamar, etc.). MÃ¡ximo 8 rondas de tool calling.
      _depth: number = 0
    ) => {
      // Safety: si el LLM lleva 8 rondas de tool calls, parar
      if (_depth >= 8) {
        const assistantMsgId = nextMsgId();
        addMessage({
          id: assistantMsgId,
          role: "assistant",
          content: "âš ï¸ Detuve la ejecuciÃ³n despuÃ©s de 8 rondas de tool calls seguidas. Esto suele indicar que el modelo entrÃ³ en un loop. Intenta reformular tu pedido.",
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
      const assistantMsgId = nextMsgId();
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
            // Enviar el modelo del settings para que el route lo use
            model: useAppStore.getState().settings?.defaultModel,
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
                // Mensaje mÃ¡s amigable para errores comunes
                let friendlyMsg = p.message;
                if (typeof p.message === "string") {
                  if (p.message.includes("429") || p.message.toLowerCase().includes("rate")) {
                    friendlyMsg = "El servicio de IA estÃ¡ temporalmente saturado. Espera unos segundos y vuelve a intentarlo â€” tu mensaje y archivos siguen disponibles.";
                  } else if (p.message.includes("403")) {
                    friendlyMsg = "Acceso bloqueado a la API de IA. Si configuraste tu API key de Groq en Settings, verifica que sea vÃ¡lida.";
                  }
                }
                accContent += `\n\nâš ï¸ ${friendlyMsg}`;
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

            // Ejecutar (async â€” read_attached_files llama al VLM para imÃ¡genes)
            const { result, uiAction } = await executeToolCall(
              tc.name,
              tc.arguments,
              filesForTool ?? [],
              userPrompt
            );

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

            // AÃ±adir mensaje de tool result para el LLM
            const toolResultMsg: SidekickMessage = {
              id: nextMsgId(),
              role: "tool",
              content: JSON.stringify(result),
              toolCallId: tc.id,
              createdAt: new Date().toISOString(),
            };
            addMessage(toolResultMsg);
          }

          // Re-llamar al LLM con los tool results (pasando los mismos archivos/prompt)
          setThinking(false);
          // PequeÃ±a pausa para que el UI actualice
          await new Promise((r) => setTimeout(r, 300));
          const updatedMessages = [...useAppStore.getState().sidekickMessages];
          await sendToLLM(updatedMessages, filesForTool, userPrompt, _depth + 1);
        }
      } catch (e: any) {
        updateMessage(assistantMsgId, {
          streaming: false,
          content: `âš ï¸ Error de conexiÃ³n: ${e?.message ?? "desconocido"}`,
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
      const fileNames = files.map((f) => `ðŸ“Ž ${f.name} (${Math.round(f.size / 1024)}KB, ${f.mime})`).join("\n");
      fullText = `${text || "He adjuntado los siguientes archivos:"}\n\nArchivos adjuntos:\n${fileNames}\n\nPor favor lee los archivos adjuntos usando la herramienta read_attached_files.`;
    }

    const userMsg: SidekickMessage = {
      id: nextMsgId(),
      role: "user",
      content: fullText,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput("");
    // Limpiar archivos adjuntos del state AHORA, pero pasamos la lista
    // capturada `files` y `text` a sendToLLM para que el loop de tool calls
    // siga teniÃ©ndolos disponibles durante toda la conversaciÃ³n.
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
        className="w-full sm:max-w-[440px] p-0 flex flex-col bg-card"
      >
        <SheetHeader className="px-4 py-3 border-b border-border bg-gradient-to-r from-[#0072E5]/5 to-[#A25BFF]/5">
          <SheetTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0072E5] to-[#A25BFF] flex items-center justify-center text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold">Sidekick</div>
              <div className="text-[10px] text-muted-foreground font-normal flex items-center gap-1">
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
                        if (window.confirm("Â¿Limpiar conversaciÃ³n?")) {
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
              <button
                className="text-[10px] text-[#0072E5] hover:underline ml-auto"
                onClick={() => { setShowSettings(false); openGlobalSettings(true); }}
              >
                Abrir Settings â†’
              </button>
            </div>
          </div>
        )}

        {/* Context indicator */}
        {(activeBoard || selectedItem) && (
          <div className="px-4 py-1.5 border-b border-border bg-card text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-2.5 w-2.5 text-[#FFC700]" />
            <span className="truncate">
              Contexto: {activeBoard?.name}
              {selectedItem && ` â†’ ${selectedItem.name}`}
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
                Â¡Hola{me ? `, ${me.name.split(" ")[0]}` : ""}! ðŸ‘‹
              </div>
              <div className="text-xs text-muted-foreground max-w-[280px] mx-auto mb-4">
                Soy Sidekick. PÃ­deme en lenguaje natural lo que quieras hacer en
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
                {/* Acciones rÃ¡pidas */}
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
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>Â·</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>Â·</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>Â·</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 bg-card">
          {/* Archivos adjuntos */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0072E5]/10 border border-[#0072E5]/20 text-[11px]">
                  <Paperclip className="h-3 w-3 text-[#0072E5]" />
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <span className="text-[9px] text-muted-foreground">{Math.round(f.size / 1024)}KB</span>
                  <button
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-[#E2445C]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              files.forEach((file) => {
                const isImage = file.type.startsWith("image/") ||
                  /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name);
                const isText =
                  file.type.startsWith("text/") ||
                  file.type.includes("json") ||
                  file.type.includes("csv") ||
                  /\.(txt|json|csv|md|js|ts|tsx|jsx|py|sql|xml|html|css|log|yaml|yml|sh)$/i.test(file.name);

                const reader = new FileReader();
                reader.onload = () => {
                  const content = typeof reader.result === "string" ? reader.result : "";
                  setAttachedFiles((prev) => [
                    ...prev,
                    {
                      name: file.name,
                      size: file.size,
                      mime: file.type || (isImage ? "image/png" : "application/octet-stream"),
                      content,
                    },
                  ]);
                };
                reader.onerror = () => {
                  // Si falla la lectura, al menos guardamos la metadata
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
                if (isImage) {
                  // Leer como data URL (base64) para enviar al VLM
                  reader.readAsDataURL(file);
                } else if (isText) {
                  reader.readAsText(file);
                } else {
                  // Binario no soportado (PDF, Excel, etc.) â€” solo metadata
                  setAttachedFiles((prev) => [
                    ...prev,
                    {
                      name: file.name,
                      size: file.size,
                      mime: file.type || "application/octet-stream",
                      content: `(archivo binario: ${file.type || "tipo desconocido"} â€” solo se soportan imÃ¡genes y texto por ahora)`,
                    },
                  ]);
                }
              });
              e.target.value = "";
            }}
          />
          <div className="relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="PÃ­deme cualquier cosaâ€¦ (Enter para enviar)"
              className="min-h-[44px] max-h-[120px] resize-none text-sm pl-10 pr-10"
              rows={1}
              disabled={thinking}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute left-1.5 bottom-1.5 h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-[#0072E5] hover:bg-secondary transition"
              title="Adjuntar archivo"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <Button
              size="sm"
              className="absolute right-1 bottom-1 h-7 w-7 p-0 bg-[#0072E5] hover:bg-[#0058B5]"
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
          <div className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
            Sidekick puede ejecutar acciones. Verifica antes de confirmar cambios destructivos.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// MessageBubble â€” renderiza un mensaje con tool calls
// ============================================================================
function MessageBubble({ msg }: { msg: SidekickMessage }) {
  const isUser = msg.role === "user";
  const isTool = msg.role === "tool";

  if (isTool) {
    // Los mensajes de tool result no se muestran directamente, solo vÃ­a el
    // tool call del assistant que los originÃ³
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
          {msg.content || (msg.streaming ? "" : "â€¦")}
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
            {msg.backend === "groq" ? "Groq" : "Z.ai"} Â· {msg.model}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// ToolCallCard â€” muestra un tool call ejecutÃ¡ndose con su resultado
// ============================================================================
function ToolCallCard({
  tc,
}: {
  tc: NonNullable<SidekickMessage["toolCalls"]>[0];
}) {
  const [expanded, setExpanded] = useState(false);

  const toolLabels: Record<string, string> = {
    list_boards: "ðŸ“‹ Listar boards",
    get_active_board: "ðŸ“Š Obtener board activo",
    get_item: "ðŸ” Ver item",
    search_items: "ðŸ”Ž Buscar items",
    create_item: "âž• Crear item",
    create_items_batch: "âž• Crear items (batch)",
    update_column_value: "âœï¸ Actualizar columna",
    move_item: "ðŸ”„ Mover item",
    delete_item: "ðŸ—‘ï¸ Eliminar item",
    add_update: "ðŸ’¬ AÃ±adir update",
    add_group: "ðŸ“ Crear grupo",
    navigate_to_board: "ðŸ§­ Navegar a board",
    open_item: "ðŸ“‚ Abrir item",
    summarize_board: "ðŸ“Š Resumir board",
    find_at_risk_items: "âš ï¸ Encontrar items en riesgo",
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
// SidekickButton â€” botÃ³n flotante estilo monday sidekick (esquina inferior derecha)
// ============================================================================
export function SidekickButton() {
  const open = useAppStore((s) => s.showSidekick);
  const setOpen = useAppStore((s) => s.setShowSidekick);

  if (open) return null; // oculto cuando el panel estÃ¡ abierto

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

