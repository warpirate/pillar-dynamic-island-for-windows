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

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex items-center justify-center bg-black text-white p-6 text-center">
          <div className="max-w-md">
            <h1 className="text-lg font-semibold mb-2">PILLAR recovered from an error</h1>
            <p className="text-white/70 text-sm">
              Something crashed in the UI. Reload the app if controls stop responding.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
