import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-paper gridfield flex flex-col items-center justify-center gap-3 p-6">
          <span className="eyebrow">Line stopped</span>
          <h1 className="page-title text-xl">Gridly hit an error</h1>
          <p className="body-text text-muted text-center max-w-md">
            {this.state.error.message || "Something failed while rendering this screen."}
          </p>
          <button
            className="btn btn-primary btn-md"
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >
            Reload the page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
