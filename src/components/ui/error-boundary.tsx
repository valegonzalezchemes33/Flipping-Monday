"use client";
// ============================================================================
// ErrorBoundary — captura errores de componentes hijos y muestra UI amigable
// ============================================================================
import React from "react";
import { Button } from "./button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[200px] bg-background text-center">
          <div className="w-12 h-12 rounded-full bg-[#E2445C]/15 flex items-center justify-center mb-3">
            <AlertTriangle className="h-6 w-6 text-[#E2445C]" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Algo salió mal</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-md">
            Este componente encontró un error inesperado. Puedes intentar recargarlo o recargar la página.
          </p>
          {this.state.error && (
            <details className="mb-4 max-w-md">
              <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                Ver detalle del error
              </summary>
              <pre className="mt-2 text-[10px] font-mono bg-secondary/60 rounded p-2 text-left overflow-x-auto text-[#E2445C]">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack?.slice(0, 300)}
              </pre>
            </details>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={this.handleRetry}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reintentar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0072E5] hover:bg-[#0058B5] text-white"
              onClick={this.handleReload}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Recargar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
