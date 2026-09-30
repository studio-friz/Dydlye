import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles.css";

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[App] Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              display: "flex",
              minHeight: "100dvh",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.5rem",
              fontFamily: "system-ui, sans-serif",
              textAlign: "center",
            }}
          >
            <div>
              <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>حدث خطأ</h1>
              <p style={{ color: "#666", marginBottom: "1.5rem" }}>
                Something went wrong. Try refreshing the page.
              </p>
              <pre
                style={{
                  fontSize: "0.75rem",
                  color: "#999",
                  maxWidth: "100%",
                  overflow: "auto",
                  textAlign: "left",
                  direction: "ltr",
                }}
              >
                {this.state.error?.message}
              </pre>
              <button
                onClick={() => window.location.reload()}
                style={{
                  marginTop: "1rem",
                  padding: "0.5rem 1.5rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                إعادة التحميل
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.innerHTML = `<div style="padding:2rem;font-family:sans-serif;text-align:center">
    <h1>حدث خطأ</h1>
    <p>لم يتم العثور على عنصر التطبيق (#root).</p>
  </div>`;
  throw new Error("Element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);
