"use client";
// ============================================================================
// GanttView — timeline horizontal con barras por fecha + dependencias visuales
// ============================================================================
import { useState, useMemo, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import type { Item } from "@/lib/types";
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

const DAY_W = 36; // px por día

export function GanttView() {
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const users = useAppStore((s) => s.users);
  const selectItem = useAppStore((s) => s.selectItem);
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const board = boards.find((b) => b.id === activeBoardId);

  const [rangeStart, setRangeStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const dateColumn = board?.columns.find((c) => c.type === "date");

  const ganttItems = useMemo(() => {
    if (!board || !dateColumn) return [];
    return board.items
      .map((it) => {
        const cv = it.columnValues.find((v) => v.columnId === dateColumn.id);
        const dateStr = cv?.value?.date;
        if (!dateStr) return null;
        const d = parseISO(dateStr);
        if (!isValid(d)) return null;
        // Para demo: duración fija de 5 días desde la fecha
        return { item: it, start: d, end: addDays(d, 5) };
      })
      .filter(Boolean) as { item: Item; start: Date; end: Date }[];
  }, [board, dateColumn]);

  if (!board) return null;
  if (!dateColumn) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Sin columna de fecha para mostrar Gantt. Añade una columna «date».
      </div>
    );
  }

  const days = 42; // 6 semanas
  const dayHeaders = Array.from({ length: days }, (_, i) => addDays(rangeStart, i));
  const totalWidth = days * DAY_W;

  // Group by groupId
  const groups = [...board.groups].sort((a, b) => a.position - b.position);

  const moveRange = (delta: number) => {
    setRangeStart((d) => addDays(d, delta * 7));
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setRangeStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          Hoy
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveRange(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveRange(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">
          {format(rangeStart, "dd MMM", { locale: es })} —{" "}
          {format(addDays(rangeStart, days - 1), "dd MMM yyyy", { locale: es })}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {ganttItems.length} items con fecha
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: item names */}
        <div className="w-[280px] shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="h-10 border-b border-border flex items-center px-3 text-[11px] font-semibold uppercase text-muted-foreground">
            Item
          </div>
          {groups.map((g) => {
            const groupItems = ganttItems.filter((gi) => gi.item.groupId === g.id);
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
                      "w-full h-9 flex items-center px-3 text-xs text-left border-b border-border hover:bg-secondary/40 transition truncate",
                      selectedItemId === item.id && "bg-[#0072E5]/5"
                    )}
                  >
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
                {groupItems.length === 0 && (
                  <div className="h-9 flex items-center px-3 text-[10px] text-muted-foreground/50 italic border-b border-border">
                    Sin items con fecha
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: timeline */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ width: totalWidth }} className="relative">
            {/* Day headers */}
            <div className="flex sticky top-0 z-10 bg-card border-b border-border h-10">
              {dayHeaders.map((d, i) => {
                const isMonStart = d.getDate() <= 7 && d.getDay() === 1;
                return (
                  <div
                    key={i}
                    className={cn(
                      "border-r border-border text-[10px] flex flex-col items-center justify-center",
                      isMonStart && "bg-secondary/30"
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
                );
              })}
            </div>

            {/* Rows */}
            {groups.map((g) => {
              const groupItems = ganttItems.filter((gi) => gi.item.groupId === g.id);
              return (
                <div key={g.id}>
                  <div
                    className="h-8 border-b border-border bg-secondary/20"
                    style={{ borderLeft: `3px solid ${g.color}` }}
                  />
                  {groupItems.map(({ item, start, end }) => {
                    const offset = differenceInDays(start, rangeStart);
                    const duration = differenceInDays(end, start) || 1;
                    if (offset + duration < 0 || offset > days) return null;
                    const statusCol = board.columns.find((c) => c.type === "status");
                    const statusCv = item.columnValues.find((v) => v.columnId === statusCol?.id);
                    const statusLabel = statusCol?.labels?.[statusCv?.value?.labelId];
                    const peopleCol = board.columns.find((c) => c.type === "people");
                    const peopleCv = item.columnValues.find((v) => v.columnId === peopleCol?.id);
                    const assignee = users.find((u) => u.id === peopleCv?.value?.userIds?.[0]);

                    return (
                      <div
                        key={item.id}
                        className="h-9 border-b border-border relative hover:bg-secondary/20"
                      >
                        <button
                          onClick={() => selectItem(item.id)}
                          className={cn(
                            "absolute top-1 bottom-1 rounded-md flex items-center px-2 text-[10px] text-white font-medium truncate hover:opacity-90 transition shadow-sm",
                            selectedItemId === item.id && "ring-2 ring-offset-1 ring-foreground"
                          )}
                          style={{
                            left: Math.max(0, offset * DAY_W),
                            width: Math.max(DAY_W, duration * DAY_W - 2),
                            background: statusLabel?.color ?? "#0072E5",
                          }}
                        >
                          <span className="truncate flex-1 text-left">{item.name}</span>
                          {assignee && (
                            <Avatar className="h-4 w-4 text-[7px] font-semibold shrink-0 ml-1">
                              <AvatarFallback
                                style={{ background: assignee.color }}
                                className="text-white"
                              >
                                {assignee.name
                                  .split(" ")
                                  .map((p) => p[0])
                                  .slice(0, 2)
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                          )}
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
