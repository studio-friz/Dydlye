import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AlertTriangle } from "lucide-react";
import App from "./App";
import "./index.css";

/**
 * Without this, any error thrown while rendering leaves a blank page and the
 * reason is only visible in the console.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        dir="rtl"
        className="flex min-h-dvh w-full items-center justify-center bg-background p-6"
      >
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h1 className="text-base font-extrabold">حدث خطأ في اللوحة</h1>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-right font-mono text-xs leading-relaxed text-muted-foreground">
            {this.state.error.message}
          </pre>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <Toaster position="top-center" richColors closeButton />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
