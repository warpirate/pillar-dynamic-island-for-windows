import { Component, type ErrorInfo, type ReactNode } from "react";

interface CrashBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface CrashBoundaryState {
  hasError: boolean;
}

export class CrashBoundary extends Component<CrashBoundaryProps, CrashBoundaryState> {
  state: CrashBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): CrashBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  private handleTryAgain = () => {
    // Reset the error state so React re-mounts children. If the underlying bug
    // persists, getDerivedStateFromError will flip hasError back to true.
    this.setState({ hasError: false });
  };

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex items-center justify-center bg-black text-white p-6 text-center">
          <div className="max-w-md flex flex-col items-center gap-4">
            <h1 className="text-lg font-semibold">PILLAR recovered from an error</h1>
            <p className="text-white/70 text-sm">
              Something crashed in the UI. Try again, or reload if controls stop responding.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.handleTryAgain}
                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-sm transition-colors"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
