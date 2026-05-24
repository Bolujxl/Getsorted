import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GetSorted crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--gs-text-primary)', background: 'var(--gs-app-bg)', minHeight: '100vh' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: 'var(--gs-text-secondary)', marginBottom: 20 }}>
            Try refreshing the page. If this keeps happening, the tasks might be corrupted.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              fontSize: 14,
              fontWeight: 600,
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'var(--gs-btn-bg)',
              color: 'var(--gs-btn-text)',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
