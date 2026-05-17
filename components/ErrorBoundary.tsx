"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
}
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 my-2">
          <p className="text-red-400 text-sm font-semibold">
            {this.props.sectionName ? `${this.props.sectionName} failed to load.` : "This section failed to load."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-red-400 text-xs underline mt-1"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
