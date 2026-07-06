"use client";
// ============================================================================
// KanbanView — vista kanban agrupada por status o priority
// ============================================================================
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Item, ColumnDef } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, parseISO, isValid } from "date-fns";
import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function KanbanView() {
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const board = boards.find((b) => b.id === activeBoardId);
  const users = useAppStore((s) => s.users);
  const selectItem = useAppStore((s) => s.selectItem);
  const moveItem = useAppStore((s) => s.moveItem);
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);

  // FIX: antes groupBy siempre era "status", pero los boards importados de
  // Excel/Monday pueden no tener una columna con id="status". Ahora
  // inicializamos con la primera columna de tipo status o priority que
  // tenga labels, o la primera columna con labels si no hay status/priority.
  const defaultGroupCol = useMemo(() => {
    if (!board) return "status";
    const statusCol = board.columns.find((c) => c.type === "status" && c.labels && Object.keys(c.labels).length > 0);
    if (statusCol) return statusCol.id;
    const priorityCol = board.columns.find((c) => c.type === "priority" && c.labels && Object.keys(c.labels).length > 0);
    if (priorityCol) return priorityCol.id;
    const anyLabelCol = board.columns.find((c) => c.labels && Object.keys(c.labels).length > 0);
    if (anyLabelCol) return anyLabelCol.id;
    return board.columns[0]?.id ?? "status";
  }, [board]);

  const [groupBy, setGroupBy] = useState<string>(defaultGroupCol);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverLabelId, setDragOverLabelId] = useState<string | null>(null);

  if (!board) return null;

  const groupColumn = board.columns.find((c) => c.id === groupBy);
  if (!groupColumn) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No hay columna «{groupBy}» para agrupar.
      </div>
    );
  }

  const labels = groupColumn.labels ?? {};
  const labelEntries = Object.entries(labels);

  const itemsForLabel = (labelId: string): Item[] =>
    board.items.filter((it) => {
      const cv = it.columnValues.find((v) => v.columnId === groupBy);
      return cv?.value?.labelId === labelId;
    });
  
  // Items sin label (no tienen la columna o no tienen label asignado)
  const unlabeledItems = board.items.filter((it) => {
    const cv = it.columnValues.find((v) => v.columnId === groupBy);
    return !cv || !cv.value?.labelId;
  });

  const handleDrop = (labelId: string) => {
    if (!draggingItemId) return;
    const item = board.items.find((i) => i.id === draggingItemId);
    if (!item) return;
    updateColumnValue(item.id, groupBy, { labelId });
    setDraggingItemId(null);
    setDragOverLabelId(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <span className="text-xs text-muted-foreground">Agrupar por:</span>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {board.columns
              .filter((c) => c.labels)
              .map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.title}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {board.items.length} items · {labelEntries.length} columnas
        </span>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-w-max">
          {labelEntries.map(([labelId, label]) => {
            const colItems = itemsForLabel(labelId);
            return (
              <div
                key={labelId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverLabelId(labelId);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(labelId);
                }}
                className={cn(
                  "w-72 shrink-0 bg-secondary/30 rounded-lg flex flex-col border border-transparent",
                  dragOverLabelId === labelId &&
                    draggingItemId !== null &&
                    "ring-2 ring-[#0072E5] ring-inset bg-[#0072E5]/5"
                )}
              >
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
                  <span
                    className="status-dot"
                    style={{ background: label.color }}
                  />
                  <span className="text-xs font-semibold text-foreground">{label.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-full font-medium ml-auto">
                    {colItems.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-220px)]">
                  {colItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border/60 rounded-md bg-secondary/20">
                      <div className="text-2xl mb-1.5 opacity-40">📋</div>
                      <div className="text-[11px] text-muted-foreground font-medium">Sin tareas aquí</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">Arrastra tareas o crea una nueva</div>
                    </div>
                  )}
                  {colItems.map((item) => (
                    <KanbanCard
                      key={item.id}
                      item={item}
                      columns={board.columns}
                      users={users}
                      onClick={() => selectItem(item.id)}
                      onDragStart={() => setDraggingItemId(item.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Columna catch-all para items sin label */}
          {unlabeledItems.length > 0 && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverLabelId("__unlabeled__");
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingItemId) {
                  const item = board.items.find((i) => i.id === draggingItemId);
                  if (item) {
                    updateColumnValue(item.id, groupBy, {});
                  }
                  setDraggingItemId(null);
                  setDragOverLabelId(null);
                }
              }}
              className={cn(
                "w-72 shrink-0 bg-secondary/30 rounded-lg flex flex-col border border-dashed border-border/60",
                dragOverLabelId === "__unlabeled__" &&
                  draggingItemId !== null &&
                  "ring-2 ring-[#0072E5] ring-inset bg-[#0072E5]/5"
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
                <span className="status-dot" style={{ background: "#C4C4C4" }} />
                <span className="text-xs font-semibold text-muted-foreground">Sin asignar</span>
                <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-full font-medium ml-auto">
                  {unlabeledItems.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-220px)]">
                {unlabeledItems.map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    columns={board.columns}
                    users={users}
                    onClick={() => selectItem(item.id)}
                    onDragStart={() => setDraggingItemId(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
function KanbanCard({
  item,
  columns,
  users,
  onClick,
  onDragStart,
}: {
  item: Item;
  columns: ColumnDef[];
  users: any[];
  onClick: () => void;
  onDragStart: () => void;
}) {
  const priorityCol = columns.find((c) => c.type === "priority");
  const priorityCv = item.columnValues.find(
    (v) => v.columnId === priorityCol?.id
  );
  const priorityLabel = priorityCol?.labels?.[priorityCv?.value?.labelId];

  const peopleCol = columns.find((c) => c.type === "people");
  const peopleCv = item.columnValues.find((v) => v.columnId === peopleCol?.id);
  const assignedUsers: any[] = (peopleCv?.value?.userIds ?? [])
    .map((id: string) => users.find((u) => u.id === id))
    .filter(Boolean);

  const dateCol = columns.find((c) => c.type === "date");
  const dateCv = item.columnValues.find((v) => v.columnId === dateCol?.id);
  const dateStr = dateCv?.value?.date;
  let dateParsed: Date | undefined;
  if (dateStr) {
    const p = parseISO(dateStr);
    if (isValid(p)) dateParsed = p;
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-card rounded-lg border border-border p-3 cursor-pointer hover:shadow-md hover:border-[#0072E5]/30 transition group card-hover"
    >
      <div className="flex items-start gap-2">
        {priorityLabel && (
          <span
            className="status-dot mt-1.5 shrink-0"
            style={{ background: priorityLabel.color }}
            title={priorityLabel.name}
          />
        )}
        <div className="flex-1 text-xs font-medium leading-snug text-foreground">
          {item.name}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-1.5">
          {dateParsed && (
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-medium">
              {format(dateParsed, "dd MMM")}
            </span>
          )}
        </div>
        <div className="flex -space-x-1.5">
          {assignedUsers.slice(0, 3).map((u) => (
            <Avatar
              key={u.id}
              className="h-5 w-5 border border-card text-[9px] font-semibold"
            >
              <AvatarFallback
                style={{ background: u.color }}
                className="text-white"
              >
                {u.name
                  .split(" ")
                  .map((p: string) => p[0])
                  .slice(0, 2)
                  .join("")}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    </div>
  );
}
