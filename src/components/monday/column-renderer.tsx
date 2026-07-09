"use client";
// ============================================================================
// ColumnRenderer — registry pattern para renderizar cada tipo de columna Monday
// Visualmente pulido: dots de status, avatares consistentes, progress bars, AI buttons
// ============================================================================
import { useState, useRef, useEffect } from "react";
import {
  Check,
  ChevronDown,
  Plus,
  Play,
  Loader2,
  Sparkles,
  Calendar as CalendarIcon,
  Mail,
  Phone,
  Link as LinkIcon,
  Star,
} from "lucide-react";
import type { ColumnDef, ColumnValue, Item, User } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { useAppStore } from "@/lib/store";
import { useAgentExecution } from "@/hooks/use-agent-execution";

interface Props {
  column: ColumnDef;
  value: ColumnValue | undefined;
  item: Item;
  users?: User[];
  compact?: boolean;
}

export function ColumnRenderer({ column, value, item, users, compact }: Props) {
  switch (column.type) {
    case "text":
    case "long_text":
    case "numbers":
    case "email":
    case "phone":
    case "link":
    case "auto_number":
    case "created_time":
    case "last_updated":
      return <TextCell column={column} value={value} item={item} compact={compact} />;
    case "status":
    case "priority":
      return <StatusCell column={column} value={value} item={item} compact={compact} />;
    case "people":
      return <PeopleCell column={column} value={value} item={item} users={users} compact={compact} />;
    case "date":
      return <DateCell column={column} value={value} item={item} compact={compact} />;
    case "checkbox":
      return <CheckboxCell column={column} value={value} item={item} compact={compact} />;
    case "rating":
      return <RatingCell column={column} value={value} item={item} compact={compact} />;
    case "progress":
      return <ProgressCell column={column} value={value} item={item} compact={compact} />;
    case "ai_agent":
      return <AIAgentCell column={column} value={value} item={item} compact={compact} />;
    case "formula":
    case "mirror":
      return (
        <div className="text-xs text-muted-foreground italic px-2">
          {value?.value?.text ?? "—"}
        </div>
      );
    default:
      return <div className="text-xs text-muted-foreground px-2">—</div>;
  }
}

// ----------------------------------------------------------------------------
function TextCell({ column, value, item, compact }: Props) {
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.value?.text ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    updateColumnValue(item.id, column.id, { text: draft });
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value?.value?.text ?? "");
            setEditing(false);
          }
        }}
        className="h-7 text-xs px-1.5"
      />
    );
  }

  const isNumeric = column.type === "numbers";
  const isEmail = column.type === "email";
  const isPhone = column.type === "phone";
  const isLink = column.type === "link";
  const display = value?.value?.text ?? "";

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "w-full text-left text-xs px-2 py-1 rounded hover:bg-secondary/60 transition min-h-[28px] flex items-center gap-1",
        isNumeric && "text-right tabular-nums",
        !display && "text-muted-foreground/40 italic",
        compact && "py-0.5"
      )}
    >
      {isEmail && display && <Mail className="h-3 w-3 text-muted-foreground shrink-0" />}
      {isPhone && display && <Phone className="h-3 w-3 text-muted-foreground shrink-0" />}
      {isLink && display && <LinkIcon className="h-3 w-3 text-[#0072E5] shrink-0" />}
      <span className={cn("truncate", isLink && "text-[#0072E5] hover:underline")}>
        {display || "—"}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
function StatusCell({ column, value, item, compact }: Props) {
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);
  const [open, setOpen] = useState(false); // FIX: controlar popover para cerrar al seleccionar
  const labels = column.labels ?? {};
  const selectedLabelId = value?.value?.labelId;
  const selected = selectedLabelId ? labels[selectedLabelId] : null;

  // Determinar si el texto debe ser negro o blanco según la luminancia del color
  // (Monday usa texto negro en amarillo claro, blanco en colores oscuros)
  const getTextColor = (bgColor: string): string => {
    // Colores claros donde el texto debe ser negro
    const lightColors = ["#FFC700", "#FFCB00", "#9CD326", "#E2445C", "#FF642E", "#C4C4C4"];
    if (lightColors.some((c) => c.toLowerCase() === bgColor.toLowerCase())) {
      return "#323338"; // texto oscuro
    }
    return "#ffffff"; // texto blanco por defecto
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-1.5 px-2 rounded text-[12px] font-medium transition min-h-[24px] hover:opacity-90",
            compact && "min-h-[20px]",
            !selected && "text-[#676879]/60 hover:bg-[rgba(103,104,121,0.1)]"
          )}
          style={
            selected
              ? {
                  background: selected.color,
                  color: getTextColor(selected.color),
                }
              : undefined
          }
        >
          <span className={cn("flex-1 text-left truncate", !selected && "text-[#676879]/60")}>
            {selected?.name ?? "—"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        <div className="text-[10px] font-semibold uppercase text-[#676879] px-2 py-1.5 tracking-wider">
          {column.title}
        </div>
        {Object.entries(labels).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              updateColumnValue(item.id, column.id, { labelId: id });
              setOpen(false); // FIX: cerrar popover al seleccionar
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-[rgba(103,104,121,0.1)] transition-colors"
          >
            <span
              className="h-3.5 w-3.5 rounded-full shrink-0 border border-black/5"
              style={{ background: label.color }}
            />
            <span className="flex-1 text-left text-[#323338]">{label.name}</span>
            {selectedLabelId === id && <Check className="h-3 w-3 text-[#0073EA]" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ----------------------------------------------------------------------------
function PeopleCell({ column, value, item, users, compact }: Props) {
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);
  const [open, setOpen] = useState(false); // FIX: controlar popover
  const selectedIds: string[] = value?.value?.userIds ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-1 px-2 rounded hover:bg-[rgba(103,104,121,0.1)] transition min-h-[28px]",
            compact && "min-h-[24px]"
          )}
        >
          {selectedIds.length === 0 ? (
            <Plus className="h-3.5 w-3.5 text-[#676879]/60" />
          ) : (
            <div className="flex items-center">
              {selectedIds.slice(0, 3).map((id, idx) => {
                const u = users?.find((x) => x.id === id);
                if (!u) return null;
                return (
                  <Avatar
                    key={id}
                    className="text-[10px] font-semibold border-2 border-white rounded-full"
                    style={{
                      width: "28px",
                      height: "28px",
                      marginLeft: idx === 0 ? 0 : "-8px",
                      zIndex: 3 - idx,
                    }}
                  >
                    <AvatarFallback
                      style={{ background: u.color }}
                      className="text-white rounded-full"
                    >
                      {u.name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {selectedIds.length > 3 && (
                <div
                  className="rounded-full bg-[#CCE5FF] border-2 border-white flex items-center justify-center text-[10px] font-semibold text-[#0073EA]"
                  style={{ width: "28px", height: "28px", marginLeft: "-8px" }}
                >
                  +{selectedIds.length - 3}
                </div>
              )}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="text-[10px] font-semibold uppercase text-muted-foreground px-2 py-1.5 tracking-wider">
          Asignar personas
        </div>
        {(users ?? []).map((u) => {
          const checked = selectedIds.includes(u.id);
          return (
            <button
              key={u.id}
              onClick={() => {
                const next = checked
                  ? selectedIds.filter((x) => x !== u.id)
                  : [...selectedIds, u.id];
                updateColumnValue(item.id, column.id, { userIds: next });
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-secondary transition"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback
                  style={{ background: u.color }}
                  className="text-white text-[9px] font-semibold"
                >
                  {u.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-left truncate">{u.name}</span>
              {checked && <Check className="h-3 w-3 text-[#0072E5]" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ----------------------------------------------------------------------------
function DateCell({ column, value, item, compact }: Props) {
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);
  const [open, setOpen] = useState(false);
  const dateStr = value?.value?.date;
  let parsed: Date | undefined;
  if (dateStr) {
    const p = parseISO(dateStr);
    if (isValid(p)) parsed = p;
  }

  // Determine if date is overdue or soon
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = parsed && parsed < today;
  const isSoon = parsed && parsed >= today && (parsed.getTime() - today.getTime()) < 3 * 86400000;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs hover:bg-secondary/60 transition min-h-[28px]",
            compact && "py-0.5",
            !dateStr && "text-muted-foreground/40",
            isOverdue && "text-[#E2445C] font-medium",
            isSoon && !isOverdue && "text-[#FFC700] font-medium"
          )}
        >
          <CalendarIcon className={cn("h-3 w-3 shrink-0", !dateStr && "opacity-40")} />
          {parsed ? format(parsed, "dd MMM yyyy") : "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed}
          onSelect={(d) => {
            if (d) {
              // FIX: usar año/mes/día local en vez de toISOString() que
              // desplaza la fecha un día para atrás en timezones UTC+
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              updateColumnValue(item.id, column.id, {
                date: `${year}-${month}-${day}`,
              });
            }
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ----------------------------------------------------------------------------
function CheckboxCell({ column, value, item, compact }: Props) {
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);
  const checked = value?.value?.checked === true;
  return (
    <button
      onClick={() =>
        updateColumnValue(item.id, column.id, { checked: !checked })
      }
      className={cn(
        "w-5 h-5 rounded border-2 flex items-center justify-center transition mx-auto",
        checked
          ? "bg-[#00C875] border-[#00C875]"
          : "border-muted-foreground/30 hover:border-[#00C875] bg-card",
        compact && "w-4 h-4"
      )}
    >
      {checked && <Check className="h-3 w-3 text-white" strokeWidth={4} />}
    </button>
  );
}

// ----------------------------------------------------------------------------
function RatingCell({ column, value, item, compact }: Props) {
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);
  const max = 5;
  const current: number = value?.value?.value ?? 0;

  return (
    <div className={cn("flex items-center gap-0.5 px-2", compact && "px-1")}>
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          onClick={() =>
            updateColumnValue(item.id, column.id, { value: i + 1 })
          }
          className={cn(
            "text-sm leading-none transition p-0.5",
            i < current
              ? "text-[#FFC700]"
              : "text-muted-foreground/30 hover:text-[#FFC700]"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", i < current && "fill-current")} />
        </button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
function ProgressCell({ column, value, item, compact }: Props) {
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);
  const current: number = value?.value?.value ?? 0;

  const color =
    current >= 100 ? "#00C875" : current >= 50 ? "#FFC700" : current > 0 ? "#0072E5" : "#C4C4C4";

  return (
    <div className={cn("w-full px-2 py-1", compact && "py-0.5")}>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${current}%`, background: color }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
          {current}%
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
function AIAgentCell({ column, value, item, compact }: Props) {
  const agents = useAppStore((s) => s.agents);
  const agentIds = column.agentIds ?? [];
  const cellAgents = agents.filter((a) => agentIds.includes(a.id));
  const lastOutput = value?.value?.lastOutput as string | undefined;

  const [running, setRunning] = useState(false);
  const { runAgent } = useAgentExecution();
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);

  if (cellAgents.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground/60 italic px-2 py-1 flex items-center gap-1">
        <Sparkles className="h-2.5 w-2.5" />
        Sin agente
      </div>
    );
  }

  const agent = cellAgents[0];

  const handleRun = async () => {
    setRunning(true);
    try {
      const execId = await runAgent(agent, item);
      const exec = useAppStore
        .getState()
        .executions.find((e) => e.id === execId);
      if (exec?.output) {
        const outStr =
          typeof exec.output === "string"
            ? exec.output
            : JSON.stringify(exec.output);
        updateColumnValue(item.id, column.id, {
          lastRunId: execId,
          lastOutput: outStr.slice(0, 200),
        });
      }
    } finally {
      setRunning(false);
    }
  };

  // Si hay output previo, mostrarlo con estilo
  if (lastOutput && !running) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition min-h-[28px] bg-[#0072E5]/5 hover:bg-[#0072E5]/10 border border-[#0072E5]/20",
              compact && "py-0.5"
            )}
            title={lastOutput}
          >
            <span className="text-sm shrink-0">{agent.icon ?? "🤖"}</span>
            <span className="flex-1 text-left truncate text-[#0072E5] font-medium">
              {lastOutput}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1 tracking-wider">
            Output del agente
          </div>
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-foreground max-h-[200px] overflow-y-auto">
            {lastOutput}
          </pre>
          <button
            onClick={handleRun}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium bg-[#0072E5] hover:bg-[#0058B5] text-white transition"
          >
            <Play className="h-3 w-3" />
            Re-ejecutar
          </button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <button
      onClick={handleRun}
      disabled={running}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition border min-h-[28px]",
        running
          ? "bg-[#0072E5]/10 border-[#0072E5]/30 text-[#0072E5] pulse-ring"
          : "bg-card border-[#0072E5]/20 text-[#0072E5] hover:bg-[#0072E5]/8 hover:border-[#0072E5]/40",
        compact && "py-0.5"
      )}
      title={`Ejecutar ${agent.name}`}
    >
      {running ? (
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
      ) : (
        <Play className="h-3 w-3 shrink-0" />
      )}
      <span className="text-sm shrink-0">{agent.icon ?? "🤖"}</span>
      <span className="truncate">{running ? "Ejecutando…" : agent.name}</span>
    </button>
  );
}
