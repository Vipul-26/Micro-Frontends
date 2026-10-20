import { Component, type ReactNode } from "react";

type RemoteBoundaryProps = {
  label: string;
  children: ReactNode;
};

type RemoteBoundaryState = {
  error: Error | null;
};

export class RemoteBoundary extends Component<RemoteBoundaryProps, RemoteBoundaryState> {
  state: RemoteBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RemoteBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="remote-error">
        <p>{this.props.label}</p>
      </div>
    );
  }
}
