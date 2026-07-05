"use client";
// ============================================================================
// ChartView — vista de gráficos (bar, pie, line) sobre los datos del board
// ============================================================================
import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
} from "lucide-react";

type ChartType = "bar" | "pie" | "line";

export function ChartView() {
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const board = boards.find((b) => b.id === activeBoardId);

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedColumn, setSelectedColumn] = useState<string>("");

  // Columnas aptas para gráficos (status, priority, numbers)
  const chartableColumns = useMemo(() => {
    if (!board) return [];
    return board.columns.filter(
      (c) =>
        c.type === "status" ||
        c.type === "priority" ||
        c.type === "numbers" ||
        c.type === "rating"
    );
  }, [board]);

  // Auto-seleccionar primera columna status (sin effect)
  const effectiveSelectedColumn = selectedColumn || chartableColumns.find((c) => c.type === "status" || c.type === "priority")?.id || chartableColumns[0]?.id || ""; 

  const chartData = useMemo(() => {
    if (!board || !effectiveSelectedColumn) return [];
    const col = board.columns.find((c) => c.id === effectiveSelectedColumn);
    if (!col) return [];
    const localColors: Record<string, string> = {};

    if (col.type === "status" || col.type === "priority") {
      const counts: Record<string, number> = {};
      board.items.forEach((item) => {
        const cv = item.columnValues.find((v) => v.columnId === effectiveSelectedColumn);
        let label = "Sin valor";
        let color = "#C4C4C4";

        if (cv?.value?.labelId && col.labels?.[cv.value.labelId]) {
          label = col.labels[cv.value.labelId].name;
          color = col.labels[cv.value.labelId].color;
        } else if (cv?.value?.text) {
          label = cv.value.text;
        }

        counts[label] = (counts[label] ?? 0) + 1;
        if (!localColors[label]) localColors[label] = color;
      });
      return Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        fill: localColors[name] ?? "#579BFC",
      }));
    } else if (col.type === "numbers") {
      // Mostrar valores numéricos por item
      return board.items.slice(0, 20).map((item) => {
        const cv = item.columnValues.find((v) => v.columnId === effectiveSelectedColumn);
        const val = Number(cv?.value?.text ?? 0);
        return { name: item.name.slice(0, 15), value: isNaN(val) ? 0 : val };
      });
    }
    return [];
  }, [board, effectiveSelectedColumn]);

  if (!board) return null;

  if (chartableColumns.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8">
        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <div className="text-sm font-medium mb-1">Sin columnas para graficar</div>
        <div className="text-xs text-muted-foreground max-w-xs">
          Añade columnas de tipo Estado, Prioridad o Números para crear gráficos.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gráfico</span>
        <div className="flex items-center gap-1">
          {([
            { type: "bar", icon: <BarChart3 className="h-3.5 w-3.5" />, label: "Barras" },
            { type: "pie", icon: <PieIcon className="h-3.5 w-3.5" />, label: "Circular" },
            { type: "line", icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Línea" },
          ] as { type: ChartType; icon: React.ReactNode; label: string }[]).map((opt) => (
            <button
              key={opt.type}
              onClick={() => setChartType(opt.type)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition",
                chartType === opt.type
                  ? "bg-[#0072E5] text-white"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={effectiveSelectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
          className="h-7 text-xs rounded border border-border bg-card px-2"
        >
          {chartableColumns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {board.items.length} tareas
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-hidden p-4">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin datos para mostrar
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EE" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill ?? "#0072E5"} />
                  ))}
                </Bar>
              </BarChart>
            ) : chartType === "pie" ? (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={(entry: any) => `${entry.name}: ${entry.value}`}
                  labelLine={false}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill ?? "#0072E5"} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EE" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="value" stroke="#0072E5" strokeWidth={2} dot={{ fill: "#0072E5", r: 4 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
