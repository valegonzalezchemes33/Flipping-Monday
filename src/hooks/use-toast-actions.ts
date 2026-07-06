"use client";
// ============================================================================
// useToastActions — instala toasts automáticos para acciones del store
// ============================================================================
// FIX: antes este hook era un no-op (useEffect vacío). Ahora subscribimos
// a cambios del store y emitimos toasts cuando detectamos nuevas entradas
// en activities (item_created, update_posted, etc.).
import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

export function useToastActions() {
  // Track del último activity count para detectar nuevos
  const lastActivityCountRef = useRef(0);

  useEffect(() => {
    // Inicializar el count con el estado actual (no tostar al montar)
    let prevCount = useAppStore.getState().activities.length;
    lastActivityCountRef.current = prevCount;

    // Zustand subscribe con listener simple — chequeamos cambios manualmente
    const unsubscribe = useAppStore.subscribe(() => {
      const currentCount = useAppStore.getState().activities.length;
      if (currentCount > prevCount) {
        // Hay nuevas activities — obtener solo las nuevas
        const newActivities = useAppStore.getState().activities.slice(0, currentCount - prevCount);
        for (const act of newActivities) {
          showToastForActivity(act.type, act.data);
        }
      }
      prevCount = currentCount;
      lastActivityCountRef.current = currentCount;
    });

    return () => unsubscribe();
  }, []);
}

function showToastForActivity(type: string, data: any) {
  switch (type) {
    case "item_created":
      toast.success("Tarea creada", {
        description: data?.name ? `"${data.name}"` : undefined,
      });
      break;
    case "update_posted":
      toast.success("Update publicado");
      break;
    case "item_archived":
      toast.success("Tarea archivada");
      break;
    // No tostar para column_changed, item_updated (demasiado ruidoso)
  }
}
