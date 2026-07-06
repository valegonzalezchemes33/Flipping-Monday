"use client";
// ============================================================================
// FormView — vista de formulario tipo Monday Forms
// Renderiza cada columna del board como input con label. Submit crea nuevo item.
// ============================================================================
import { useState, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Send,
  Sparkles,
  Check,
} from "lucide-react";
import type { ColumnDef, User } from "@/lib/types";

// ============================================================================
// FormColumnField — renderiza un campo de formulario para cada tipo de columna
// (definido FUERA de FormView para evitar recreación en cada render)
// ============================================================================
function FormColumnField({
  column,
  value,
  users,
  onChange,
}: {
  column: ColumnDef;
  value: any;
  users: User[];
  onChange: (val: any) => void;
}) {
  switch (column.type) {
    case "text":
    case "numbers":
    case "email":
    case "phone":
    case "link":
      return (
        <Input
          value={value?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={`Ingresa ${column.title.toLowerCase()}...`}
          className="h-8 text-xs px-2 border-0 focus-visible:ring-0"
        />
      );

    case "long_text":
      return (
        <textarea
          value={value?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={`Ingresa ${column.title.toLowerCase()}...`}
          className="w-full h-20 text-xs px-2 py-1.5 bg-transparent resize-none focus:outline-none"
        />
      );

    case "status":
    case "priority":
    case "dropdown": {
      const labels = column.labels ?? {};
      return (
        <div className="flex flex-wrap gap-1 px-2 py-1">
          {Object.entries(labels).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ labelId: id })}
              className="text-[10px] px-2 py-1 rounded-full font-medium transition border"
              style={{
                backgroundColor: value?.labelId === id ? `${label.color}25` : "transparent",
                borderColor: value?.labelId === id ? label.color : "var(--border)",
                color: value?.labelId === id ? label.color : "var(--muted-foreground)",
              }}
            >
              {label.name}
            </button>
          ))}
        </div>
      );
    }

    case "date":
      return (
        <input
          type="date"
          value={value?.date ?? ""}
          onChange={(e) => onChange({ date: e.target.value })}
          className="h-8 text-xs px-2 bg-transparent border-0 focus:outline-none w-full"
        />
      );

    case "people":
      return (
        <div className="flex flex-wrap gap-1 px-2 py-1">
          {users.map((u) => {
            const selected = (value?.userIds ?? []).includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  const ids = value?.userIds ?? [];
                  onChange({
                    userIds: selected
                      ? ids.filter((x: string) => x !== u.id)
                      : [...ids, u.id],
                  });
                }}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full font-medium transition border",
                  selected ? "text-white" : "text-muted-foreground border-border"
                )}
                style={selected ? { backgroundColor: u.color, borderColor: u.color } : {}}
              >
                {u.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      );

    case "checkbox":
      return (
        <button
          type="button"
          onClick={() => onChange({ checked: !value?.checked })}
          className="w-6 h-6 rounded border-2 flex items-center justify-center mx-2 transition"
          style={{
            backgroundColor: value?.checked ? "#00C875" : "transparent",
            borderColor: value?.checked ? "#00C875" : "var(--border)",
          }}
        >
          {value?.checked && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      );

    case "rating":
      return (
        <div className="flex items-center gap-0.5 px-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange({ value: star })}
              className="text-sm p-0.5"
            >
              <span className={star <= (value?.value ?? 0) ? "text-[#FFC700]" : "text-muted-foreground/30"}>
                ★
              </span>
            </button>
          ))}
        </div>
      );

    default:
      return (
        <div className="text-xs text-muted-foreground italic px-2 py-1">
          {column.type} — no editable en formulario
        </div>
      );
  }
}

// ============================================================================
// FormView — vista de formulario principal
// ============================================================================
export function FormView() {
  const board = useAppStore((s) => s.boards.find((b) => b.id === s.activeBoardId));
  const users = useAppStore((s) => s.users);
  const addItem = useAppStore((s) => s.addItem);
  const updateColumnValue = useAppStore((s) => s.updateColumnValue);

  const [title, setTitle] = useState("");
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  if (!board) return null;

  const visibleColumns = board.columns.filter((c) => c.id !== "name");

  const handleColumnChange = (columnId: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [columnId]: value }));
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("El nombre del item es obligatorio");
      return;
    }
    const groupId = board.groups[0]?.id ?? "";
    const itemId = addItem(board.id, groupId, title.trim());

    // Aplicar column values capturados localmente
    const capturedValues = { ...formValues };
    Object.entries(capturedValues).forEach(([colId, colValue]) => {
      if (colValue && typeof colValue === 'object' && Object.keys(colValue).length > 0) {
        updateColumnValue(itemId, colId, colValue);
      }
    });

    setSubmitted(true);
    toast.success("Item creado", {
      description: `"${title.trim()}" añadido a ${board.name}`,
    });
    setTimeout(() => {
      setTitle("");
      setFormValues({});
      setSubmitted(false);
    }, 3000);
  };

  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#00C875]/10 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-[#00C875]" />
          </div>
          <h2 className="text-lg font-semibold mb-1">¡Item creado!</h2>
          <p className="text-sm text-muted-foreground mb-4">
            "{title}" se añadió a {board.name}
          </p>
          <Button
            onClick={() => {
              setSubmitted(false);
              setTitle("");
            }}
            className="bg-[#0072E5] hover:bg-[#0058B5] text-white"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Crear otro item
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div ref={formRef} className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold">Formulario: {board.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Completa los campos para crear un nuevo item en este board
          </p>
        </div>

        <Card className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Nombre del item
              <span className="text-[#E2445C]">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Nueva oportunidad de venta..."
              className="h-9 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          {visibleColumns.map((col) => (
            <div key={col.id} className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                {col.title}
                {col.type === "text" && <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>}
              </label>
              <div className="rounded-lg border border-border bg-background min-h-[36px] flex items-center">
                <FormColumnField
                  column={col}
                  value={formValues[col.id] || {}}
                  users={users}
                  onChange={(val) => handleColumnChange(col.id, val)}
                />
              </div>
            </div>
          ))}

          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="w-full h-10 bg-[#0072E5] hover:bg-[#0058B5] text-white font-medium"
            >
              <Send className="h-4 w-4 mr-1.5" />
              Enviar
            </Button>
          </div>
        </Card>

        <p className="text-[10px] text-muted-foreground text-center">
          Los items se crearán en el grupo &quot;{board.groups[0]?.title ?? "Group 1"}&quot;
        </p>
      </div>
    </div>
  );
}
