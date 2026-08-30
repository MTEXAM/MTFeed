import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[200px] flex items-center justify-center p-6 bg-red-50/50 rounded-2xl border border-red-200 my-4 text-center">
          <div className="max-w-md">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {this.props.fallbackTitle || 'เกิดข้อผิดพลาดในการแสดงผล'}
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              ระบบตรวจพบข้อผิดพลาดบางประการ กรุณากดปุ่มด้านล่างเพื่อลองใหม่อีกครั้ง
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-full shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              ลองใหม่อีกครั้ง
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
