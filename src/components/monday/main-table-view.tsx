"use client";
// ============================================================================
// MainTableView — tabla estilo Monday con grupos, columnas, inline edit, drag-drop
// Soporta: sorts, filters, groupBy, hiddenColumns, multi-select, contextual menus
// ============================================================================
import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter as FilterIcon,
  Copy,
  Trash2,
  Archive,
  FolderInput,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Item, Group as GroupType, ColumnDef } from "@/lib/types";
import { ColumnRenderer } from "./column-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function MainTableView() {
  // OPTIMIZACIÓN: subscribirse SOLO al board activo, no a todo el array de boards.
  // Antes: const boards = useAppStore((s) => s.boards) causaba re-render en
  // cualquier mutación de cualquier board. Ahora solo re-renderiza cuando
  // cambia el board activo.
  const board = useAppStore((s) => s.boards.find((b) => b.id === s.activeBoardId));
  const users = useAppStore((s) => s.users);
  const selectItem = useAppStore((s) => s.selectItem);
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const addItem = useAppStore((s) => s.addItem);
  const moveItem = useAppStore((s) => s.moveItem);
  const updateItemName = useAppStore((s) => s.updateItemName);
  const toggleGroupCollapse = useAppStore((s) => s.toggleGroupCollapse);
  const renameGroup = useAppStore((s) => s.renameGroup);
  const duplicateGroup = useAppStore((s) => s.duplicateGroup);
  const deleteGroup = useAppStore((s) => s.deleteGroup);
  const deleteItem = useAppStore((s) => s.deleteItem);
  const duplicateItem = useAppStore((s) => s.duplicateItem);
  const archiveItem = useAppStore((s) => s.archiveItem);
  const reorderItem = useAppStore((s) => s.reorderItem);
  const addColumn = useAppStore((s) => s.addColumn);
  const setShowAddColumn = useAppStore((s) => s.setShowAddColumn);
  const sorts = useAppStore((s) => s.sorts);
  const filters = useAppStore((s) => s.filters);
  const hiddenColumns = useAppStore((s) => s.hiddenColumns);
  const selectedRowIds = useAppStore((s) => s.selectedRowIds);
  const toggleRowSelection = useAppStore((s) => s.toggleRowSelection);
  const selectAllRows = useAppStore((s) => s.selectAllRows);
  const clearRowSelection = useAppStore((s) => s.clearRowSelection);

  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [colNameDraft, setColNameDraft] = useState("");

  // ---- Aplicar sorts, filters, hiddenColumns ----
  const visibleColumns = useMemo(() => {
    if (!board) return [];
    const filtered = board.columns.filter((c) => !hiddenColumns.includes(c.id));
    return [
      filtered.find((c) => c.id === "name")!,
      ...filtered.filter((c) => c.id !== "name"),
    ].filter(Boolean);
  }, [board, hiddenColumns]);

  const filteredSortedItems = useMemo(() => {
    if (!board) return [];
    let items = board.items.filter((i) => !i.archived);

    // Filters
    if (filters.length > 0) {
      items = items.filter((it) =>
        filters.every((f) => {
          const cv = it.columnValues.find((v) => v.columnId === f.columnId);
          const v = cv?.value;
          if (f.op === "empty") return !v || Object.keys(v).length === 0;
          if (!v) return false;
          const text = v.text ?? v.labelId ?? "";
          if (f.op === "eq") return String(text) === String(f.value);
          if (f.op === "neq") return String(text) !== String(f.value);
          if (f.op === "contains") return String(text).toLowerCase().includes(String(f.value).toLowerCase());
          return true;
        })
      );
    }

    // Sorts
    if (sorts.length > 0) {
      const sorted = [...items];
      sorted.sort((a, b) => {
        for (const s of sorts) {
          const av = a.columnValues.find((v) => v.columnId === s.columnId)?.value;
          const bv = b.columnValues.find((v) => v.columnId === s.columnId)?.value;
          const aText = av?.text ?? av?.labelId ?? av?.date ?? av?.value ?? "";
          const bText = bv?.text ?? bv?.labelId ?? bv?.date ?? bv?.value ?? "";
          const aNum = Number(aText);
          const bNum = Number(bText);
          let cmp: number;
          if (!isNaN(aNum) && !isNaN(bNum)) {
            cmp = aNum - bNum;
          } else {
            cmp = String(aText).localeCompare(String(bText));
          }
          if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
        }
        return 0;
      });
      items = sorted;
    }

    return items;
  }, [board, filters, sorts]);

  if (!board) return null;

  const orderedGroups = [...board.groups].sort((a, b) => a.position - b.position);
  const allFilteredIds = filteredSortedItems.map((i) => i.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedRowIds.includes(id));

  const handleDrop = (groupId: string) => {
    if (draggingItemId) {
      moveItem(draggingItemId, groupId);
    }
    setDraggingItemId(null);
    setDragOverGroupId(null);
  };

  const handleAddItem = (groupId: string) => {
    if (newItemName.trim()) {
      addItem(board.id, groupId, newItemName.trim());
      setNewItemName("");
    }
    // FIX: siempre resetear addingToGroup en blur, incluso si está vacío.
    // Antes, si el usuario hacía blur con input vacío, el input quedaba abierto para siempre.
    setAddingToGroup(null);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Batch Actions Toolbar sticky ── */}
      {selectedRowIds.length > 0 && (
        <div className="sticky top-0 z-30 bg-[#0072E5] shadow-lg">
          <div className="flex items-center gap-1 px-3 py-2 text-white text-xs">
            {/* Count + deselect */}
            <div className="flex items-center gap-2 mr-2">
              <button
                onClick={clearRowSelection}
                className="w-5 h-5 rounded flex items-center justify-center bg-white/20 hover:bg-white/30 transition text-white font-bold text-[10px]"
                title="Deseleccionar"
              >
                ✕
              </button>
              <span className="font-semibold">
                {selectedRowIds.length} elemento{selectedRowIds.length > 1 ? "s" : ""} seleccionado{selectedRowIds.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="w-px h-4 bg-white/30 mx-1" />

            {/* Mover a grupo */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/20 transition font-medium">
                  <FolderInput className="h-3 w-3" />
                  Mover a
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  Mover a grupo
                </div>
                <DropdownMenuSeparator />
                {board.groups.map((g) => (
                  <DropdownMenuItem
                    key={g.id}
                    onClick={() => {
                      selectedRowIds.forEach((id) => moveItem(id, g.id));
                      clearRowSelection();
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm mr-2 shrink-0"
                      style={{ background: g.color }}
                    />
                    {g.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Duplicar */}
            <button
              onClick={() => {
                selectedRowIds.forEach((id) => duplicateItem(id));
                clearRowSelection();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/20 transition font-medium"
            >
              <Copy className="h-3 w-3" />
              Duplicar
            </button>

            {/* Archivar */}
            <button
              onClick={() => {
                selectedRowIds.forEach((id) => archiveItem(id));
                clearRowSelection();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/20 transition font-medium"
            >
              <Archive className="h-3 w-3" />
              Archivar
            </button>

            <div className="w-px h-4 bg-white/30 mx-1" />

            {/* Eliminar */}
            <button
              onClick={() => {
                if (confirm(`¿Eliminar ${selectedRowIds.length} elemento(s)?`)) {
                  selectedRowIds.forEach((id) => deleteItem(id));
                  clearRowSelection();
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/80 transition font-medium text-red-100"
            >
              <Trash2 className="h-3 w-3" />
              Eliminar
            </button>
          </div>
        </div>
      )}


      {/* Column header */}
      <div className="flex items-stretch border-b border-border bg-card text-[11px] font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 z-10">
        <div className="w-8 shrink-0 border-r border-border flex items-center justify-center">
          <input
            type="checkbox"
            className="h-3 w-3 accent-[#0072E5]"
            checked={allSelected}
            onChange={() =>
              allSelected ? clearRowSelection() : selectAllRows(allFilteredIds)
            }
          />
        </div>
        {visibleColumns.map((col) => {
          const sort = sorts.find((s) => s.columnId === col.id);
          const isRenaming = renamingCol === col.id;
          return (
            <ColumnHeader
              key={col.id}
              col={col}
              sort={sort}
              isRenaming={isRenaming}
              colNameDraft={colNameDraft}
              setColNameDraft={setColNameDraft}
              onStartRename={() => {
                setRenamingCol(col.id);
                setColNameDraft(col.title);
              }}
              onCommitRename={(newTitle) => {
                if (newTitle.trim()) {
                  // rename via patch (treats column as immutable, so we addColumn equivalent - here we mutate via set on boards)
                  useAppStore.setState((s) => ({
                    boards: s.boards.map((b) =>
                      b.id === board.id
                        ? {
                            ...b,
                            columns: b.columns.map((c) =>
                              c.id === col.id ? { ...c, title: newTitle.trim() } : c
                            ),
                          }
                        : b
                    ),
                  }));
                }
                setRenamingCol(null);
              }}
              onSortChange={(dir) => {
                const next = sorts.filter((s) => s.columnId !== col.id);
                if (dir) next.push({ columnId: col.id, dir });
                useAppStore.getState().setSorts(next);
              }}
              onDeleteColumn={() => {
                if (window.confirm(`¿Eliminar columna «${col.title}»?`)) {
                  useAppStore.getState().deleteColumn(board.id, col.id);
                }
              }}
            />
          );
        })}
        <div className="w-12 shrink-0 flex items-center justify-center border-l border-border">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground"
            onClick={() => setShowAddColumn(true)}
            title="Añadir columna"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Grouped rows */}
      <div className="flex-1 overflow-y-auto">
        {orderedGroups.map((group) => (
          <GroupBlock
            key={group.id}
            boardId={board.id}
            group={group}
            items={filteredSortedItems.filter((i) => i.groupId === group.id)}
            columns={visibleColumns}
            users={users}
            selectedItemId={selectedItemId}
            selectedRowIds={selectedRowIds}
            groupsForMove={orderedGroups}
            onSelectItem={selectItem}
            onToggleRow={toggleRowSelection}
            onUpdateItemName={updateItemName}
            onToggleCollapse={() => toggleGroupCollapse(board.id, group.id)}
            onRenameGroup={(title) => renameGroup(board.id, group.id, title)}
            onDuplicateGroup={() => duplicateGroup(board.id, group.id)}
            onDeleteGroup={() => {
              if (window.confirm(`¿Eliminar grupo «${group.title}» y sus items?`)) {
                deleteGroup(board.id, group.id);
              }
            }}
            onDuplicateItem={duplicateItem}
            onArchiveItem={archiveItem}
            onDeleteItem={(id) => {
              if (window.confirm("¿Eliminar item?")) deleteItem(id);
            }}
            onMoveItem={(itemId, toGroupId) => moveItem(itemId, toGroupId)}
            draggingItemId={draggingItemId}
            dragOverGroupId={dragOverGroupId}
            dragOverItemId={dragOverItemId}
            onDragStart={(id) => setDraggingItemId(id)}
            onDragOver={(gid) => setDragOverGroupId(gid)}
            onDragOverItem={(iid) => setDragOverItemId(iid)}
            onDrop={handleDrop}
            onDropOnItem={(targetItemId) => {
              if (draggingItemId && draggingItemId !== targetItemId) {
                const target = board.items.find((i) => i.id === targetItemId);
                if (target) reorderItem(draggingItemId, target.position);
              }
              setDraggingItemId(null);
              setDragOverGroupId(null);
              setDragOverItemId(null);
            }}
            addingToGroup={addingToGroup}
            setAddingToGroup={setAddingToGroup}
            newItemName={newItemName}
            setNewItemName={setNewItemName}
            onAddItem={handleAddItem}
          />
        ))}

        {/* Add group */}
        <div className="p-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              const title = window.prompt("Nombre del nuevo grupo:");
              if (title) useAppStore.getState().addGroup(board.id, title);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nuevo grupo
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
function ColumnHeader({
  col,
  sort,
  isRenaming,
  colNameDraft,
  setColNameDraft,
  onStartRename,
  onCommitRename,
  onSortChange,
  onDeleteColumn,
}: {
  col: ColumnDef;
  sort?: { dir: "asc" | "desc" };
  isRenaming: boolean;
  colNameDraft: string;
  setColNameDraft: (s: string) => void;
  onStartRename: () => void;
  onCommitRename: (s: string) => void;
  onSortChange: (dir: "asc" | "desc" | null) => void;
  onDeleteColumn: () => void;
}) {
  const cycleSort = () => {
    if (!sort) onSortChange("asc");
    else if (sort.dir === "asc") onSortChange("desc");
    else onSortChange(null);
  };
  return (
    <div
      className="px-2 py-2 border-r border-border last:border-r-0 flex items-center gap-1 hover:bg-secondary/40 cursor-pointer group"
      style={{ width: col.width ?? 140, minWidth: 100 }}
      onClick={cycleSort}
    >
      {isRenaming ? (
        <Input
          autoFocus
          value={colNameDraft}
          onChange={(e) => setColNameDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => onCommitRename(colNameDraft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename(colNameDraft);
            if (e.key === "Escape") onCommitRename("");
          }}
          className="h-6 text-xs px-1"
        />
      ) : (
        <>
          <span className="truncate">{col.title}</span>
          {col.type === "ai_agent" && <span className="text-[#0072E5]">🤖</span>}
          {sort ? (
            sort.dir === "asc" ? (
              <ArrowUp className="h-3 w-3 text-[#0072E5]" />
            ) : (
              <ArrowDown className="h-3 w-3 text-[#0072E5]" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />
          )}
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="ml-auto opacity-0 group-hover:opacity-100 h-5 w-5 hover:bg-secondary rounded flex items-center justify-center"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onStartRename}>Renombrar</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("asc")}>
            <ArrowUp className="h-3 w-3 mr-2" />
            Sort ascendente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("desc")}>
            <ArrowDown className="h-3 w-3 mr-2" />
            Sort descendente
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-[#E2445C]"
            onClick={onDeleteColumn}
            disabled={col.id === "name"}
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Eliminar columna
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ----------------------------------------------------------------------------
function GroupBlock({
  boardId,
  group,
  items,
  columns,
  users,
  selectedItemId,
  selectedRowIds,
  groupsForMove,
  onSelectItem,
  onToggleRow,
  onUpdateItemName,
  onToggleCollapse,
  onRenameGroup,
  onDuplicateGroup,
  onDeleteGroup,
  onDuplicateItem,
  onArchiveItem,
  onDeleteItem,
  onMoveItem,
  draggingItemId,
  dragOverGroupId,
  onDragStart,
  onDragOver,
  onDrop,
  addingToGroup,
  setAddingToGroup,
  newItemName,
  setNewItemName,
  onAddItem,
}: {
  boardId: string;
  group: GroupType;
  items: Item[];
  columns: ColumnDef[];
  users: any[];
  selectedItemId: string | null;
  selectedRowIds: string[];
  groupsForMove: GroupType[];
  onSelectItem: (id: string | null) => void;
  onToggleRow: (id: string) => void;
  onUpdateItemName: (id: string, name: string) => void;
  onToggleCollapse: () => void;
  onRenameGroup: (title: string) => void;
  onDuplicateGroup: () => void;
  onDeleteGroup: () => void;
  onDuplicateItem: (id: string) => void;
  onArchiveItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onMoveItem: (itemId: string, toGroupId: string) => void;
  draggingItemId: string | null;
  dragOverGroupId: string | null;
  dragOverItemId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (gid: string) => void;
  onDragOverItem: (iid: string) => void;
  onDrop: (gid: string) => void;
  onDropOnItem: (targetItemId: string) => void;
  addingToGroup: string | null;
  setAddingToGroup: (id: string | null) => void;
  newItemName: string;
  setNewItemName: (s: string) => void;
  onAddItem: (gid: string) => void;
}) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  return (
    <div
      className={cn(
        "border-b border-border",
        dragOverGroupId === group.id && draggingItemId !== null && "drag-over"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(group.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(group.id);
      }}
    >
      {/* Group header */}
      <div className="flex items-center gap-1 px-2 py-1 bg-secondary/40 group">
        <button onClick={onToggleCollapse} className="p-0.5 hover:bg-secondary rounded">
          {group.collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab" />
        <span
          className="h-3 w-3 rounded-sm shrink-0"
          style={{ background: group.color }}
        />
        {editingName === group.id ? (
          <Input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              if (nameDraft.trim()) onRenameGroup(nameDraft.trim());
              setEditingName(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (nameDraft.trim()) onRenameGroup(nameDraft.trim());
                setEditingName(null);
              }
            }}
            className="h-6 text-xs px-1 max-w-[200px]"
          />
        ) : (
          <button
            onClick={() => {
              setNameDraft(group.title);
              setEditingName(group.id);
            }}
            className="text-xs font-semibold text-foreground hover:text-[#0072E5] transition"
          >
            {group.title}
          </button>
        )}
        <span className="text-[10px] text-muted-foreground">{items.length}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={() => setAddingToGroup(group.id)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Item
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setNameDraft(group.title);
                  setEditingName(group.id);
                }}
              >
                Renombrar grupo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicateGroup}>
                <Copy className="h-3 w-3 mr-2" />
                Duplicar grupo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[#E2445C]"
                onClick={onDeleteGroup}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Eliminar grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Items */}
      {!group.collapsed && (
        <div>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              columns={columns}
              users={users}
              selected={selectedItemId === item.id}
              rowSelected={selectedRowIds.includes(item.id)}
              onSelect={() => onSelectItem(item.id)}
              onToggleRow={() => onToggleRow(item.id)}
              onDragStart={() => onDragStart(item.id)}
              onDragOver={(e) => {
                e.preventDefault();
                onDragOverItem(item.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDropOnItem(item.id);
              }}
              isDragOver={dragOverItemId === item.id}
              onUpdateName={(name) => onUpdateItemName(item.id, name)}
              onDuplicate={() => onDuplicateItem(item.id)}
              onArchive={() => onArchiveItem(item.id)}
              onDelete={() => onDeleteItem(item.id)}
              onMove={(toGroupId) => onMoveItem(item.id, toGroupId)}
              groupsForMove={groupsForMove}
            />
          ))}
          {addingToGroup === group.id && (
            <div className="flex items-stretch border-b border-border bg-card">
              <div className="w-8 shrink-0 border-r border-border" />
              <div className="flex-1 px-2 py-1">
                <Input
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nombre del item…"
                  onBlur={() => onAddItem(group.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onAddItem(group.id);
                    if (e.key === "Escape") {
                      setAddingToGroup(null);
                      setNewItemName("");
                    }
                  }}
                  className="h-7 text-xs px-1.5"
                />
              </div>
            </div>
          )}
          {items.length === 0 && addingToGroup !== group.id && (
            <div className="flex items-stretch border-b border-border bg-card">
              <div className="w-8 shrink-0 border-r border-border" />
              <div className="px-2 py-1.5">
                <button
                  onClick={() => setAddingToGroup(group.id)}
                  className="text-[11px] text-[#0072E5] hover:text-[#0058B5] flex items-center gap-1 font-medium transition"
                >
                  <Plus className="h-3 w-3" />
                  Agregar tarea
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
function ItemRow({
  item,
  columns,
  users,
  selected,
  rowSelected,
  onSelect,
  onToggleRow,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  onUpdateName,
  onDuplicate,
  onArchive,
  onDelete,
  onMove,
  groupsForMove,
}: {
  item: Item;
  columns: ColumnDef[];
  users: any[];
  selected: boolean;
  rowSelected: boolean;
  onSelect: () => void;
  onToggleRow: () => void;
  onDragStart: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  onUpdateName: (name: string) => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMove: (toGroupId: string) => void;
  groupsForMove: GroupType[];
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={cn(
        "flex items-stretch border-b border-border bg-card cursor-pointer transition group hover:bg-secondary/20",
        selected && "bg-[#0072E5]/5 ring-1 ring-inset ring-[#0072E5]/20",
        rowSelected && "bg-[#0072E5]/8",
        isDragOver && "border-t-2 border-t-[#0072E5] drag-over"
      )}
    >
      <div className="w-8 shrink-0 border-r border-border flex items-center justify-center">
        <input
          type="checkbox"
          checked={rowSelected}
          onChange={onToggleRow}
          onClick={(e) => e.stopPropagation()}
          className="h-3 w-3 accent-[#0072E5]"
        />
      </div>
      {columns.map((col) => {
        const cv = item.columnValues.find((x) => x.columnId === col.id);
        return (
          <div
            key={col.id}
            className="border-r border-border last:border-r-0 flex items-center min-w-0 overflow-hidden"
            style={{ width: col.width ?? 140, minWidth: 100 }}
          >
            {col.id === "name" ? (
              editingName ? (
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => {
                    onUpdateName(nameDraft);
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onUpdateName(nameDraft);
                      setEditingName(false);
                    }
                    if (e.key === "Escape") {
                      setNameDraft(item.name);
                      setEditingName(false);
                    }
                  }}
                  className="h-7 text-xs px-1.5 w-full"
                />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingName(true);
                  }}
                  title={item.name}
                  className="w-full text-left text-xs px-2 py-1.5 truncate hover:bg-secondary/60 rounded font-medium text-foreground"
                >
                  {item.name}
                </button>
              )
            ) : (
              <ColumnRenderer column={col} value={cv} item={item} users={users} />
            )}
          </div>
        );
      })}
      <div className="w-12 shrink-0 flex items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-3 w-3 mr-2" />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-3 w-3 mr-2" />
              Archivar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground">
              Mover a grupo
            </div>
            {groupsForMove
              .filter((g) => g.id !== item.groupId)
              .map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  onClick={() => onMove(g.id)}
                  className="gap-2"
                >
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: g.color }}
                  />
                  {g.title}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[#E2445C]" onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
