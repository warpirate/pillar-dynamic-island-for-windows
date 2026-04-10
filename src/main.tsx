import React from "react";
import ReactDOM from "react-dom/client";
import { useEffect } from "react";
import App from "./App";
import "./index.css";
import { CrashBoundary } from "./components/CrashBoundary";
import { useCrashRecovery } from "./hooks/useCrashRecovery";

function AppWithRecovery() {
  const { reportCrash } = useCrashRecovery({
    enableAutoRecovery: true,
    crashThreshold: 3,
    timeWindow: 60_000,
  });

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      reportCrash(event.error ?? event.message, {
        severity: "severe",
        component: "window",
        action: "error",
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportCrash(event.reason instanceof Error ? event.reason : String(event.reason), {
        severity: "moderate",
        component: "window",
        action: "unhandledrejection",
      });
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [reportCrash]);

  return (
    <CrashBoundary
      onError={(error, errorInfo) =>
        reportCrash(error, {
          severity: "critical",
          component: "ReactTree",
          action: errorInfo.componentStack ? "render_with_stack" : "render",
        })
      }
    >
      <App />
    </CrashBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppWithRecovery />
  </React.StrictMode>
);
