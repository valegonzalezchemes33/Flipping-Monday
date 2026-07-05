"use client";
// ============================================================================
// ItemDetailDrawer — Sheet lateral con tabs: Updates / Activity / Files / Subitems / AI
// ============================================================================
import { useState, useRef, useEffect, useMemo } from "react";
import { useAppStore, findActiveBoard, findItem } from "@/lib/store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  MessageSquare,
  Activity,
  Paperclip,
  ListTree,
  Bot,
  Send,
  Sparkles,
  Play,
  Loader2,
  ChevronRight,
  Plus,
  Clock,
} from "lucide-react";
import { AgentPanel } from "./agent-panel";
import { ColumnRenderer } from "./column-renderer";
import type { ActivityEvent } from "@/lib/types";

export function ItemDetailDrawer() {
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const selectItem = useAppStore((s) => s.selectItem);
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const users = useAppStore((s) => s.users);
  const tab = useAppStore((s) => s.itemDetailTab);
  const setTab = useAppStore((s) => s.setItemDetailTab);

  const item = useMemo(
    () => findItem({ boards, activeBoardId } as any, selectedItemId),
    [boards, activeBoardId, selectedItemId]
  );
  const board = useMemo(
    () => boards.find((b) => b.id === activeBoardId),
    [boards, activeBoardId]
  );

  if (!item || !board) {
    return null;
  }

  return (
    <Sheet open={!!selectedItemId} onOpenChange={(o) => !o && selectItem(null)}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px] p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-4 pb-3 border-b border-border">
          <SheetTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3" />
            {board.groups.find((g) => g.id === item.groupId)?.title ?? "—"}
          </SheetTitle>
          <SheetDescription className="text-base font-semibold text-foreground mt-0.5">
            {item.name}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as any)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="justify-start rounded-none border-b border-border bg-transparent h-auto p-0 px-3 gap-0">
            <DetailTabTrigger value="updates" icon={<MessageSquare className="h-3.5 w-3.5" />} label="Updates" />
            <DetailTabTrigger value="activity" icon={<Activity className="h-3.5 w-3.5" />} label="Activity" />
            <DetailTabTrigger value="files" icon={<Paperclip className="h-3.5 w-3.5" />} label="Files" />
            <DetailTabTrigger value="subitems" icon={<ListTree className="h-3.5 w-3.5" />} label="Subitems" />
            <DetailTabTrigger value="ai" icon={<Bot className="h-3.5 w-3.5" />} label="AI Agent" highlight />
          </TabsList>

          <div className="flex-1 overflow-y-auto bg-background">
            <TabsContent value="updates" className="m-0 p-4 mt-0">
              <UpdatesTab itemId={item.id} />
            </TabsContent>
            <TabsContent value="activity" className="m-0 p-4 mt-0">
              <ActivityTab itemId={item.id} />
            </TabsContent>
            <TabsContent value="files" className="m-0 p-4 mt-0">
              <FilesTab itemId={item.id} />
            </TabsContent>
            <TabsContent value="subitems" className="m-0 p-4 mt-0">
              <SubitemsTab itemId={item.id} />
            </TabsContent>
            <TabsContent value="ai" className="m-0 p-0 mt-0">
              <AgentPanel itemId={item.id} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer: column values quick view — con separador claro */}
        {tab !== "ai" && (
          <div className="border-t-2 border-border bg-card p-4">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-3 tracking-wider">
              Columnas
            </div>
            <div className="grid grid-cols-2 gap-2">
              {board.columns
                .filter((c) => c.id !== "name")
                .map((col) => {
                  const cv = item.columnValues.find((v) => v.columnId === col.id);
                  return (
                    <div key={col.id} className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {col.title}
                      </span>
                      <div className="rounded-md border border-border min-h-[28px] flex items-center bg-background">
                        <ColumnRenderer
                          column={col}
                          value={cv}
                          item={item}
                          users={users}
                          compact
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailTabTrigger({
  value,
  icon,
  label,
  highlight,
}: {
  value: string;
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "rounded-none border-b-2 border-transparent data-[state=active]:border-[#0072E5] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2.5 text-xs font-medium text-muted-foreground data-[state=active]:text-[#0072E5] gap-1.5 min-w-[90px] justify-center",
      )}
    >
      {icon}
      {label}
      {highlight && <Sparkles className="h-3 w-3 text-[#0072E5]" />}
    </TabsTrigger>
  );
}

// ----------------------------------------------------------------------------
function UpdatesTab({ itemId }: { itemId: string }) {
  const allUpdates = useAppStore((s) => s.updates);
  const updates = useMemo(
    () => allUpdates.filter((u) => u.itemId === itemId),
    [allUpdates, itemId]
  );
  const users = useAppStore((s) => s.users);
  const currentUser = useAppStore((s) => s.currentUserId);
  const addUpdate = useAppStore((s) => s.addUpdate);
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);

  const me = users.find((u) => u.id === currentUser);

  // Filtrar users para mention autocomplete
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [mentionQuery, users]);

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft(val);
    // Detectar @mention
    const cursorPos = e.target.selectionStart;
    const before = val.slice(0, cursorPos);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(cursorPos - atMatch[0].length);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (user: { id: string; name: string }) => {
    const before = draft.slice(0, mentionStart);
    const after = draft.slice(mentionStart + (mentionQuery?.length ?? 0) + 1);
    const newName = `@${user.name.split(" ")[0]}`;
    setDraft(`${before}${newName} ${after}`);
    setMentionQuery(null);
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    addUpdate(itemId, draft.trim());
    setDraft("");
  };

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="border border-border rounded-lg p-2 bg-card relative">
        <Textarea
          value={draft}
          onChange={handleDraftChange}
          placeholder="Escribe un update… Usa @ para mencionar. Los agentes ejecutados aquí también aparecerán."
          className="border-0 resize-none min-h-[60px] text-sm focus-visible:ring-0"
        />
        {/* Mention autocomplete popover */}
        {mentionQuery !== null && mentionMatches.length > 0 && (
          <div className="absolute z-50 left-2 right-2 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
            <div className="px-2 py-1 text-[9px] uppercase font-bold text-muted-foreground bg-secondary/50">
              Mencionar
            </div>
            {mentionMatches.map((u) => (
              <button
                key={u.id}
                onClick={() => insertMention(u)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-secondary text-left text-xs"
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback
                    style={{ background: u.color }}
                    className="text-white text-[9px] font-semibold"
                  >
                    {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{u.name}</span>
                <span className="text-[10px] text-muted-foreground truncate">{u.email}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-1 px-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5 cursor-pointer hover:text-foreground" />
            <span className="text-[11px]">@ mencionar</span>
          </div>
          <Button size="sm" className="h-7 text-xs bg-[#0072E5] hover:bg-[#0058B5] text-white" onClick={handleSend} disabled={!draft.trim()}>
            <Send className="h-3 w-3 mr-1" />
            Update
          </Button>
        </div>
      </div>

      {/* Updates list */}
      <div className="space-y-3">
        {updates.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            Sin updates todavía.
          </div>
        )}
        {updates.map((upd) => {
          const author = users.find((u) => u.id === upd.authorId);
          const isAgent = upd.body.startsWith("🤖");
          return (
            <div key={upd.id} className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback
                  className={cn(
                    "text-[10px] font-semibold",
                    isAgent ? "bg-[#0072E5] text-white" : "text-white"
                  )}
                  style={!isAgent ? { background: author?.color } : {}}
                >
                  {isAgent ? "🤖" : author?.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{author?.name ?? "Agente"}</span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(upd.createdAt), { addSuffix: true, locale: es })}
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-1 text-sm rounded-lg p-2.5",
                    isAgent
                      ? "bg-[#0072E5]/5 border border-[#0072E5]/20 text-foreground whitespace-pre-wrap"
                      : "bg-secondary/60 text-foreground"
                  )}
                >
                  {upd.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
function ActivityTab({ itemId }: { itemId: string }) {
  const allActivities = useAppStore((s) => s.activities);
  const activities = useMemo(
    () => allActivities.filter((a) => a.itemId === itemId),
    [allActivities, itemId]
  );
  const users = useAppStore((s) => s.users);
  const agents = useAppStore((s) => s.agents);

  if (activities.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground py-8">
        Sin actividad registrada.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((act) => (
        <ActivityRow
          key={act.id}
          event={act}
          user={users.find((u) => u.id === act.userId)}
          agent={agents.find((a) => a.id === act.agentId)}
        />
      ))}
    </div>
  );
}

function ActivityRow({ event, user, agent }: { event: ActivityEvent; user?: any; agent?: any }) {
  const icon = event.type.startsWith("agent_") ? (
    <Bot className="h-3.5 w-3.5 text-[#0072E5]" />
  ) : event.type === "update_posted" ? (
    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
  ) : event.type === "column_changed" ? (
    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
  ) : (
    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
  );

  const label = (() => {
    switch (event.type) {
      case "agent_completed":
        return `${agent?.name ?? "Agente"} completó ejecución`;
      case "agent_failed":
        return `${agent?.name ?? "Agente"} falló`;
      case "agent_run":
        return `${agent?.name ?? "Agente"} inició ejecución`;
      case "update_posted":
        return `${user?.name ?? "Usuario"} publicó un update`;
      case "column_changed":
        return `${user?.name ?? "Usuario"} cambió una columna`;
      case "item_created":
        return `${user?.name ?? "Usuario"} creó el item`;
      default:
        return event.type;
    }
  })();

  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-xs">{label}</div>
        <div className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: es })}
        </div>
        {event.data && Object.keys(event.data).length > 0 && (
          <pre className="mt-1 text-[10px] bg-secondary/60 rounded p-2 overflow-x-auto">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
function FilesTab({ itemId }: { itemId: string }) {
  const allFiles = useAppStore((s) => s.files);
  const currentUser = useAppStore((s) => s.currentUserId);
  const addFile = useAppStore((s) => s.addFile);
  const deleteFile = useAppStore((s) => s.deleteFile);
  const setShowAgentBuilder = useAppStore((s) => s.setShowAgentBuilder);
  const files = useMemo(
    () => allFiles.filter((f) => f.itemId === itemId),
    [allFiles, itemId]
  );

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = e.target.files;
    if (!fs) return;
    Array.from(fs).forEach((file) => {
      addFile({
        itemId,
        name: file.name,
        size: file.size,
        mime: file.type,
        uploadedById: currentUser,
      });
    });
    e.target.value = "";
  };

  const fmtSize = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  const fileIcon = (mime: string) => {
    if (mime.startsWith("image/")) return "🖼️";
    if (mime.includes("pdf")) return "📄";
    if (mime.includes("word") || mime.includes("docx")) return "📝";
    if (mime.includes("sheet") || mime.includes("excel")) return "📊";
    if (mime.includes("zip")) return "🗜️";
    return "📎";
  };

  return (
    <div className="space-y-3">
      <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-[#0072E5] transition cursor-pointer">
        <input
          type="file"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <Paperclip className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <div className="text-xs font-medium">Arrastra archivos o click para subir</div>
        <div className="text-[10px] text-muted-foreground mt-1">
          Doc Extractor puede extraer datos automáticamente
        </div>
      </label>

      {files.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-4">
          Sin archivos adjuntos.
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 p-2 border border-border rounded-md hover:bg-secondary/30 group"
            >
              <span className="text-base">{fileIcon(f.mime)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {fmtSize(f.size)} · {formatDistanceToNow(new Date(f.createdAt), { addSuffix: true, locale: es })}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-[#0072E5] opacity-0 group-hover:opacity-100"
                onClick={() => setShowAgentBuilder(true)}
              >
                Extraer con IA
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[#E2445C] opacity-0 group-hover:opacity-100"
                onClick={() => deleteFile(f.id)}
              >
                <Plus className="h-3 w-3 rotate-45" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
function SubitemsTab({ itemId }: { itemId: string }) {
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const addSubitem = useAppStore((s) => s.addSubitem);
  const deleteSubitem = useAppStore((s) => s.deleteSubitem);
  const item = useMemo(
    () => boards.flatMap((b) => b.items).find((i) => i.id === itemId),
    [boards, itemId]
  );
  const board = useMemo(
    () => boards.find((b) => b.id === activeBoardId),
    [boards, activeBoardId]
  );
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  if (!item) return null;
  const subItems = item.subItems ?? [];

  const handleAdd = () => {
    if (!name.trim()) return;
    addSubitem(itemId, name.trim());
    setName("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {subItems.length} subitems
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Agregar
        </Button>
      </div>

      {adding && (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nombre del subitem…"
            className="h-7 text-xs"
          />
          <Button size="sm" className="h-7" onClick={handleAdd}>
            OK
          </Button>
        </div>
      )}

      {subItems.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-8">
          Sin subitems.
        </div>
      ) : (
        subItems.map((si) => {
          const statusCol = board?.columns.find((c) => c.type === "status");
          const statusCv = si.columnValues.find(
            (v) => v.columnId === statusCol?.id
          );
          const label = statusCol?.labels?.[statusCv?.value?.labelId];
          return (
            <div
              key={si.id}
              className="flex items-center gap-2 p-2 bg-card border border-border rounded-md text-xs group"
            >
              {label && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: label.color }}
                />
              )}
              <span className="flex-1">{si.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                onClick={() => deleteSubitem(itemId, si.id)}
                title="Eliminar subitem"
              >
                <Plus className="h-3 w-3 rotate-45" />
              </Button>
            </div>
          );
        })
      )}
    </div>
  );
}
