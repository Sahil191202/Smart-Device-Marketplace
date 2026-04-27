import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-dark-900">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-3xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              Something went wrong
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed">
              An unexpected error occurred. This has been noted and we'll look into it.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left text-red-600 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl mb-6 overflow-auto max-h-40">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;