// ============================================================================
// undo-middleware — Zustand middleware que añade history stack con snapshot
// Cada mutación captura el estado ANTES de mutar, permitiendo ⌘Z / ⌘⇧Z
// ============================================================================

const MAX_HISTORY = 50;

/**
 * Envuelve un selector parcial para que undo solo restaure las keys relevantes.
 * state => PartialState (solo las keys que queremos trackear)
 */
export type UndoableState<T> = T & {
  _undo: UndoHistory;
};

export interface UndoHistory {
  /** Stack de snapshots anteriores (past[0] = más reciente) */
  past: any[];
  /** Stack de snapshots rehechos (future[0] = más reciente) */
  future: any[];
}

/**
 * Crea un historial de undo vacío.
 */
export function createUndoHistory(): UndoHistory {
  return { past: [], future: [] };
}

/**
 * Keys del store que NO queremos trackear en undo (estado UI transitorio).
 * Mutaciones de estas keys no generan snapshot.
 */
const UI_KEYS = new Set([
  "_hasHydrated", "setHasHydrated",
  "selectedItemId", "selectedRowIds", "activeViewId",
  "showAgentBuilder", "showOrchestrator", "showExportImport",
  "commandPaletteOpen", "showAutomations", "showAddColumn",
  "showAddBoard", "showAddView", "showNewPlan", "showNewAutomation",
  "showMondayConnect", "showMondayImport", "showSidekick", "showSettings",
  "sidebarView", "sidekickMessages", "sidekickThinking",
  "filters", "sorts", "groupBy", "hiddenColumns",
  "itemDetailTab",
  "mondayApiKey", "mondayConnected", "mondayAccount",
  "importState",
]);

/**
 * Snapshot keys — solo las que contienen datos de negocio.
 */
export function businessSnapshot(state: any): any {
  const snapshot: any = {};
  for (const key of Object.keys(state)) {
    if (!UI_KEYS.has(key) && !key.startsWith("_") && key !== "_undo") {
      snapshot[key] = JSON.parse(JSON.stringify(state[key]));
    }
  }
  return snapshot;
}

/**
 * Extrae undo history del estado.
 */
export function getUndoHistory(state: any): UndoHistory {
  return state._undo ?? { past: [], future: [] };
}

/**
 * Verifica si el snapshot capturado difiere del estado actual (evita
 * snapshots vacíos cuando se llama set con el mismo estado).
 */
function hasChanged(snapshot: any, state: any): boolean {
  for (const key of Object.keys(snapshot)) {
    if (JSON.stringify(snapshot[key]) !== JSON.stringify(state[key])) {
      return true;
    }
  }
  return false;
}

/**
 * Middleware que envuelve set() de Zustand para capturar snapshots.
 *
 * Uso:
 *   const useStore = create<AppState>()(
 *     undoMiddleware(persist((set, get) => ({ ... }), persistOpts))
 *   );
 *
 * Luego en el store se exponen:
 *   undo: () => void
 *   redo: () => void
 *   canUndo: boolean
 *   canRedo: boolean
 */
export function undoMiddleware<T extends { _undo: UndoHistory }>(
  config: (set: any, get: any, api: any) => T
) {
  return (set: any, get: any, api: any) => {
    // Flag para evitar que undo/redo disparen otro snapshot
    let isUndoingOrRedoing = false;

    const wrappedSet = (partial: any, replace?: boolean) => {
      const prevState = get();
      
      // Capturar snapshot del estado anterior SOLO si:
      // 1. No estamos en medio de undo/redo
      // 2. La mutación toca keys de negocio (no UI)
      if (!isUndoingOrRedoing) {
        const keysToSet = typeof partial === "function" 
          ? Object.keys(partial(prevState)) 
          : Object.keys(partial);
        
        const hasBusinessKeys = keysToSet.some((k) => !UI_KEYS.has(k));
        
        if (hasBusinessKeys) {
          const snapshot = businessSnapshot(prevState);
          const history = getUndoHistory(prevState);
          
          // Solo push si realmente hay cambios
          if (hasChanged(snapshot, prevState)) {
            const newPast = [snapshot, ...history.past].slice(0, MAX_HISTORY);
            set({ _undo: { past: newPast, future: [] } }, true);
          }
        }
      }

      // Llamar al set original
      set(partial, replace);
    };

    const store = config(wrappedSet, get, api);

    // Añadir acciones undo/redo al store
    return {
      ...store,
      _undo: createUndoHistory(),

      get canUndo(): boolean {
        return getUndoHistory(get()).past.length > 0;
      },

      get canRedo(): boolean {
        return getUndoHistory(get()).future.length > 0;
      },

      undo: () => {
        const state = get();
        const history = getUndoHistory(state);
        if (history.past.length === 0) return;

        isUndoingOrRedoing = true;
        try {
          const [prevSnapshot, ...rest] = history.past;
          // Guardar estado actual en future
          const currentSnapshot = businessSnapshot(state);
          const newFuture = [currentSnapshot, ...history.future].slice(0, MAX_HISTORY);
          
          // Restaurar snapshot anterior
          set({
            ...prevSnapshot,
            _undo: { past: rest, future: newFuture },
          }, true);
        } finally {
          isUndoingOrRedoing = false;
        }
      },

      redo: () => {
        const state = get();
        const history = getUndoHistory(state);
        if (history.future.length === 0) return;

        isUndoingOrRedoing = true;
        try {
          const [nextSnapshot, ...rest] = history.future;
          // Guardar estado actual en past
          const currentSnapshot = businessSnapshot(state);
          const newPast = [currentSnapshot, ...history.past].slice(0, MAX_HISTORY);
          
          // Restaurar snapshot del futuro
          set({
            ...nextSnapshot,
            _undo: { past: newPast, future: rest },
          }, true);
        } finally {
          isUndoingOrRedoing = false;
        }
      },
    };
  };
}
