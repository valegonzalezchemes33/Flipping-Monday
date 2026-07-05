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
    lastActivityCountRef.current = useAppStore.getState().activities.length;

    const unsubscribe = useAppStore.subscribe((state) => {
      const currentCount = state.activities.length;
      if (currentCount > lastActivityCountRef.current) {
        // Hay nuevas activities — mostrar toast para cada una nueva
        const newCount = currentCount - lastActivityCountRef.current;
        const newActivities = state.activities.slice(0, newCount);
        for (const act of newActivities) {
          showToastForActivity(act.type, act.data);
        }
      }
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
