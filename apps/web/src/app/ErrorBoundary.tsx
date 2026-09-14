import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string },
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TasteSync] UI error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-shell boot-screen">
        <div className="boot-card">
          <span className="brand-mark">T</span>
          <strong>Экран не удалось загрузить</strong>
          <span>{this.state.message || 'Неизвестная ошибка интерфейса'}</span>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
