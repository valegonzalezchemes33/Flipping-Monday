"use client";
// ============================================================================
// MondayConnectDialog — cargar API key, validar, guardar conexión
// ============================================================================
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Link2,
  Unlink,
  Sparkles,
  Shield,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnected?: () => void;
}

export function MondayConnectDialog({ open, onOpenChange, onConnected }: Props) {
  const mondayApiKey = useAppStore((s) => s.mondayApiKey);
  const mondayConnected = useAppStore((s) => s.mondayConnected);
  const mondayAccount = useAppStore((s) => s.mondayAccount);
  const setMondayConnection = useAppStore((s) => s.setMondayConnection);
  const disconnectMonday = useAppStore((s) => s.disconnectMonday);

  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { ok: boolean; account?: any; error?: string }
    | null
  >(null);

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/monday/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        setMondayConnection(apiKey.trim(), data.account);
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        error: e?.message ?? "Error de red al conectar con Monday",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectMonday();
    setApiKey("");
    setTestResult(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setApiKey("");
      setTestResult(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[#0072E5]" />
            Conectar con Monday.com
          </DialogTitle>
          <DialogDescription className="text-xs">
            Importa tus boards, items, columns, users y teams desde tu cuenta de
            Monday.com a este sistema.
          </DialogDescription>
        </DialogHeader>

        {/* Estado: ya conectado */}
        {mondayConnected && mondayAccount ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#00C875]/8 border border-[#00C875]/30">
              <div className="w-10 h-10 rounded-full bg-[#00C875] flex items-center justify-center text-white shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  Cuenta conectada
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {mondayAccount.name} · {mondayAccount.email}
                </div>
              </div>
              <Badge className="bg-[#00C875] hover:bg-[#00C875] text-white text-[10px] capitalize">
                {mondayAccount.planTier}
              </Badge>
            </div>

            <div className="text-[11px] text-muted-foreground bg-secondary/40 rounded p-2.5 flex gap-2">
              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#0072E5]" />
              <div>
                Tu API key se guarda localmente en este navegador y solo se usa para
                comunicarse con la API de Monday.com. Nunca se envía a terceros.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="flex-1 bg-[#0072E5] hover:bg-[#0058B5] text-white"
                onClick={() => {
                  handleClose(false);
                  onConnected?.();
                }}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Importar datos de Monday
              </Button>
              <Button
                variant="outline"
                className="text-[#E2445C] hover:bg-[#E2445C]/5 hover:text-[#E2445C]"
                onClick={handleDisconnect}
              >
                <Unlink className="h-3.5 w-3.5 mr-1.5" />
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          /* Estado: no conectado */
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">API Key de Monday.com</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="font-mono text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && apiKey.trim()) handleTest();
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Obtén tu API token en{" "}
                <a
                  href="https://monday.com/developer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0072E5] hover:underline inline-flex items-center gap-0.5"
                >
                  monday.com/developer
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>{" "}
                → Profile → API
              </p>
            </div>

            {testResult && !testResult.ok && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-[#E2445C]/8 border border-[#E2445C]/30 text-[11px] text-[#E2445C]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">No se pudo conectar</div>
                  <div className="opacity-90">{testResult.error}</div>
                </div>
              </div>
            )}

            {testResult && testResult.ok && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-[#00C875]/8 border border-[#00C875]/30 text-[11px] text-[#00C875]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">¡Conexión exitosa!</div>
                  <div className="opacity-90">
                    Cuenta: {testResult.account?.name} ({testResult.account?.email})
                  </div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground bg-secondary/40 rounded p-2.5 flex gap-2">
              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#0072E5]" />
              <div>
                La API key se valida contra el endpoint oficial de Monday.com y se
                almacena localmente. No la compartas con terceros.
              </div>
            </div>
          </div>
        )}

        {!mondayConnected && (
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-[#0072E5] hover:bg-[#0058B5] text-white"
              onClick={handleTest}
              disabled={!apiKey.trim() || testing}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              {testing ? "Validando…" : "Conectar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
