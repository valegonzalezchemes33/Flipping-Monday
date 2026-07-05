"use client";
// ============================================================================
// TimelineView — barras horizontales por fecha (sin dependencias, como Monday)
// ============================================================================
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  format,
  addDays,
  differenceInDays,
  parseISO,
  isValid,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_W = 32;

export function TimelineView() {
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const users = useAppStore((s) => s.users);
  const selectItem = useAppStore((s) => s.selectItem);
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const board = boards.find((b) => b.id === activeBoardId);

  const [rangeStart, setRangeStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const dateColumn = board?.columns.find((c) => c.type === "date");

  // Items con fecha
  const timelineItems = useMemo(() => {
    if (!board || !dateColumn) return [];
    return board.items
      .map((item) => {
        const cv = item.columnValues.find((v) => v.columnId === dateColumn.id);
        const dateStr = cv?.value?.date;
        if (!dateStr) return null;
        const d = parseISO(dateStr);
        if (!isValid(d)) return null;
        // Duración: buscar columna numbers "Duración" o default 1 día
        const durCol = board.columns.find(
          (c) => c.type === "numbers" && c.title.toLowerCase().includes("dur")
        );
        const durCv = item.columnValues.find((v) => v.columnId === durCol?.id);
        const duration = Math.max(1, parseInt(durCv?.value?.text ?? "1") || 1);
        return { item, start: d, end: addDays(d, duration), duration };
      })
      .filter(Boolean) as { item: any; start: Date; end: Date; duration: number }[];
  }, [board, dateColumn]);

  if (!board) return null;

  if (!dateColumn) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Sin columna de fecha para mostrar timeline. Añade una columna «Fecha».
      </div>
    );
  }

  const days = 42;
  const dayHeaders = Array.from({ length: days }, (_, i) => addDays(rangeStart, i));
  const totalWidth = days * DAY_W;

  // Group by group
  const groups = [...board.groups].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setRangeStart(new Date())}>
          Hoy
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setRangeStart((d) => addDays(d, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setRangeStart((d) => addDays(d, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold capitalize">
          {format(rangeStart, "dd MMM", { locale: es })} —{" "}
          {format(addDays(rangeStart, days - 1), "dd MMM yyyy", { locale: es })}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {timelineItems.length} tareas con fecha
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: item names */}
        <div className="w-[260px] shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="h-10 border-b border-border flex items-center px-3 text-[11px] font-semibold uppercase text-muted-foreground">
            Tarea
          </div>
          {groups.map((g) => {
            const groupItems = timelineItems.filter((ti) => ti.item.groupId === g.id);
            return (
              <div key={g.id}>
                <div
                  className="h-8 flex items-center gap-1.5 px-3 text-xs font-semibold border-b border-border"
                  style={{ borderLeft: `3px solid ${g.color}` }}
                >
                  {g.title}
                  <span className="text-[10px] text-muted-foreground">({groupItems.length})</span>
                </div>
                {groupItems.map(({ item }) => (
                  <button
                    key={item.id}
                    onClick={() => selectItem(item.id)}
                    className={cn(
                      "w-full h-9 flex items-center px-3 text-xs text-left border-b border-border hover:bg-secondary/40 truncate",
                      selectedItemId === item.id && "bg-[#0072E5]/5"
                    )}
                  >
                    {item.name}
                  </button>
                ))}
                {groupItems.length === 0 && (
                  <div className="h-9 border-b border-border" />
                )}
              </div>
            );
          })}
        </div>

        {/* Right: timeline */}
        <div className="flex-1 overflow-auto">
          <div style={{ width: totalWidth }} className="relative">
            {/* Day headers */}
            <div className="flex sticky top-0 z-10 bg-card border-b border-border h-10">
              {dayHeaders.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "border-r border-border text-[10px] flex flex-col items-center justify-center shrink-0",
                    (d.getDay() === 0 || d.getDay() === 6) && "bg-secondary/30"
                  )}
                  style={{ width: DAY_W }}
                >
                  <span className="text-[9px] text-muted-foreground uppercase">
                    {d.getDate() === 1 || i === 0 ? format(d, "MMM", { locale: es }) : ""}
                  </span>
                  <span className={cn("font-medium", d.getDay() === 0 || d.getDay() === 6 ? "text-muted-foreground" : "")}>
                    {format(d, "d")}
                  </span>
                </div>
              ))}
            </div>

            {/* Rows */}
            {groups.map((g) => {
              const groupItems = timelineItems.filter((ti) => ti.item.groupId === g.id);
              return (
                <div key={g.id}>
                  <div
                    className="h-8 border-b border-border bg-secondary/20"
                    style={{ borderLeft: `3px solid ${g.color}` }}
                  />
                  {groupItems.map(({ item, start, end, duration }) => {
                    const offset = differenceInDays(start, rangeStart);
                    const width = Math.max(DAY_W, duration * DAY_W - 2);
                    if (offset + duration < 0 || offset > days) {
                      return <div key={item.id} className="h-9 border-b border-border" />;
                    }
                    const statusCol = board.columns.find((c) => c.type === "status");
                    const statusCv = item.columnValues.find((v) => v.columnId === statusCol?.id);
                    const statusLabel = statusCol?.labels?.[statusCv?.value?.labelId];
                    return (
                      <div key={item.id} className="h-9 border-b border-border relative hover:bg-secondary/20">
                        <button
                          onClick={() => selectItem(item.id)}
                          className={cn(
                            "absolute top-1 bottom-1 rounded flex items-center px-2 text-[10px] text-white font-medium truncate hover:opacity-90 transition shadow-sm",
                            selectedItemId === item.id && "ring-2 ring-offset-1 ring-foreground"
                          )}
                          style={{
                            left: Math.max(0, offset * DAY_W),
                            width: Math.min(width, (days - Math.max(0, offset)) * DAY_W - 2),
                            background: statusLabel?.color ?? "#0072E5",
                          }}
                        >
                          <span className="truncate">{item.name}</span>
                        </button>
                      </div>
                    );
                  })}
                  {groupItems.length === 0 && <div className="h-9 border-b border-border" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
