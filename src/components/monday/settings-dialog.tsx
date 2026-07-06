"use client";
// ============================================================================
// SettingsDialog -- Panel de configuracion global de la aplicacion
// ============================================================================

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { MODEL_CATALOG } from "@/lib/model-catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Bot,
  User,
  Palette,
  Link2,
  AlertTriangle,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";

const PROVIDER_COLORS: Record<string, string> = {
  nvidia: "#76B900",
};

const PROVIDER_LABELS: Record<string, string> = {
  nvidia: "NVIDIA NIM",
};

const TAB_ITEMS = [
  { id: "ai", label: "IA & Modelos", icon: Bot },
  { id: "account", label: "Cuenta", icon: User },
  { id: "appearance", label: "Apariencia", icon: Palette },
  { id: "monday", label: "Monday.com", icon: Link2 },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

// --- ApiKeyField ---
interface ApiKeyFieldProps {
  label: string;
  provider: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}

function ApiKeyField({ label, provider, value, onChange, placeholder, hint }: ApiKeyFieldProps) {
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const color = PROVIDER_COLORS[provider] ?? "#888";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: `${color}18`, color }}
        >
          {PROVIDER_LABELS[provider] ?? provider}
        </span>
        <Label className="text-xs font-medium">{label}</Label>
        {value && (
          <span className="ml-auto flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
            <Check className="h-2.5 w-2.5" /> Configurada
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "sk-..."}
            className="h-8 text-xs font-mono pr-8"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          disabled={!value}
        >
          {saved ? <Check className="h-3 w-3 text-emerald-600" /> : "Guardar"}
        </Button>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// --- Tab AI ---
function TabAI() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-0.5">API Key de NVIDIA NIM</h3>
          <p className="text-[11px] text-muted-foreground">
            Única API key necesaria. Se envía al servidor para todas las llamadas al modelo.
          </p>
        </div>
        <ApiKeyField
          label="NVIDIA NIM API Key"
          provider="nvidia"
          value={settings.nvidiaApiKey ?? ""}
          onChange={(v) => updateSettings({ nvidiaApiKey: v || null })}
          placeholder="nvapi-..."
          hint="API key de NVIDIA NIM (integrate.api.nvidia.com)"
        />
      </div>

      <div className="border-t border-border" />

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold mb-0.5">Modelo por defecto</h3>
          <p className="text-[11px] text-muted-foreground">
            Se usa al crear nuevos agentes. Puedes cambiarlo por agente individualmente.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {MODEL_CATALOG.map((model) => {
            const isSelected = settings.defaultModel === model.id;
            const color = PROVIDER_COLORS[model.provider] ?? "#888";
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => updateSettings({ defaultModel: model.id })}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border text-left transition",
                  isSelected
                    ? "border-[#0072E5] bg-[#0072E5]/5"
                    : "border-border hover:border-[#0072E5]/30 hover:bg-secondary/30"
                )}
              >
                <div
                  className={cn(
                    "w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
                    isSelected ? "border-[#0072E5] bg-[#0072E5]" : "border-border"
                  )}
                >
                  {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">{model.name}</span>
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded"
                      style={{ background: `${color}18`, color }}
                    >
                      {PROVIDER_LABELS[model.provider]}
                    </span>
                    {model.badge === "recommended" && (
                      <span className="text-[9px] text-emerald-600 font-semibold">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{model.description}</p>
                </div>
                {model.costTier === "free" && (
                  <span className="text-[9px] font-semibold text-emerald-600 shrink-0">Gratis</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="space-y-2">
        <Label className="text-xs font-medium">
          Temperatura por defecto:{" "}
          <span className="text-[#0072E5] font-bold">{settings.defaultTemperature}</span>
        </Label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.defaultTemperature}
          onChange={(e) => updateSettings({ defaultTemperature: Number(e.target.value) })}
          className="w-full accent-[#0072E5]"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>Preciso (0)</span>
          <span>Creativo (1)</span>
        </div>
      </div>
    </div>
  );
}

// --- Tab Account ---
function TabAccount() {
  const users = useAppStore((s) => s.users);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  if (!currentUser) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/20">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
          style={{ background: currentUser.color }}
        >
          {currentUser.name.charAt(0)}
        </div>
        <div>
          <div className="text-base font-semibold">{currentUser.name}</div>
          <div className="text-sm text-muted-foreground">{currentUser.email}</div>
          <span className="text-[10px] font-bold uppercase tracking-wide mt-0.5 inline-block px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
            {currentUser.role}
          </span>
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Nombre</Label>
          <Input defaultValue={currentUser.name} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Email</Label>
          <Input defaultValue={currentUser.email} className="h-8 text-sm" disabled />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Los cambios se guardan localmente.</p>
    </div>
  );
}

// --- Tab Appearance ---
function TabAppearance() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-medium">Tema</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["dark", "light", "system"] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => updateSettings({ theme })}
              className={cn(
                "p-3 rounded-lg border text-center text-xs font-medium transition",
                settings.theme === theme
                  ? "border-[#0072E5] bg-[#0072E5]/10 text-[#0072E5]"
                  : "border-border hover:border-[#0072E5]/30"
              )}
            >
              {theme === "dark" && "Oscuro"}
              {theme === "light" && "Claro"}
              {theme === "system" && "Sistema"}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium">Idioma</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["es", "en"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => updateSettings({ language: lang })}
              className={cn(
                "p-3 rounded-lg border text-center text-xs font-medium transition",
                settings.language === lang
                  ? "border-[#0072E5] bg-[#0072E5]/10 text-[#0072E5]"
                  : "border-border hover:border-[#0072E5]/30"
              )}
            >
              {lang === "es" ? "Espanol" : "English"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Tab Monday ---
function TabMonday() {
  const mondayConnected = useAppStore((s) => s.mondayConnected);
  const mondayAccount = useAppStore((s) => s.mondayAccount);
  const setShowMondayConnect = useAppStore((s) => s.setShowMondayConnect);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const disconnectMonday = useAppStore((s) => s.disconnectMonday);

  return (
    <div className="space-y-4">
      {mondayConnected && mondayAccount ? (
        <div className="p-4 rounded-xl border border-[#00C875]/30 bg-[#00C875]/5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00C875] animate-pulse" />
            <span className="text-sm font-semibold text-[#00C875]">Conectado</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>
              <span className="font-medium">Cuenta:</span> {mondayAccount.name}
            </p>
            <p>
              <span className="font-medium">Email:</span> {mondayAccount.email}
            </p>
            <p>
              <span className="font-medium">Plan:</span> {mondayAccount.planTier}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
            onClick={disconnectMonday}
          >
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
            <span className="text-sm font-semibold text-muted-foreground">No conectado</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Conecta tu cuenta de Monday.com para importar boards, sincronizar datos y usar la API oficial.
          </p>
          <Button
            size="sm"
            className="h-7 text-xs bg-[#0072E5] hover:bg-[#0058B5] text-white"
            onClick={() => {
              setShowSettings(false);
              setShowMondayConnect(true);
            }}
          >
            Conectar Monday.com
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Tab Danger ---
function TabDanger() {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-red-600">Resetear todos los datos</span>
        </div>
        <p className="text-[11px] text-red-600/80">
          Elimina todos los boards, agentes, automatizaciones y configuraciones locales.{" "}
          <strong>Esta accion no se puede deshacer.</strong>
        </p>
        {!confirmReset ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-100"
            onClick={() => setConfirmReset(true)}
          >
            Resetear datos
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              Confirmar reset
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setConfirmReset(false)}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SettingsDialog principal
// ============================================================================

export function SettingsDialog() {
  const open = useAppStore((s) => s.showSettings);
  const setOpen = useAppStore((s) => s.setShowSettings);
  const [activeTab, setActiveTab] = useState<TabId>("ai");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">Configuracion</DialogTitle>
          <DialogDescription className="text-xs">
            Personaliza tu experiencia en monday-AI
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden">
          <nav className="w-44 shrink-0 border-r border-border p-2 space-y-0.5 overflow-y-auto">
            {TAB_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition text-left",
                  activeTab === id
                    ? "bg-[#0072E5] text-white"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  id === "danger" && activeTab !== "danger" && "text-red-500 hover:bg-red-50"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === "ai" && <TabAI />}
            {activeTab === "account" && <TabAccount />}
            {activeTab === "appearance" && <TabAppearance />}
            {activeTab === "monday" && <TabMonday />}
            {activeTab === "danger" && <TabDanger />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
