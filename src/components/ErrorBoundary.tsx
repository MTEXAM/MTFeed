import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  private handleClearAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-red-100 shadow-xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1.5">
              {this.props.fallbackTitle || 'กำลังเตรียมระบบ MTFeed...'}
            </h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              ระบบตรวจพบข้อผิดพลาดหรือข้อมูลแคชเดิมค้างอยู่ในเบราว์เซอร์ กรุณากดปุ่มเพื่อรีเฟรชหรือล้างแคช
            </p>
            {this.state.error && (
              <div className="mb-4 p-3 bg-red-50/70 border border-red-100 rounded-xl text-left overflow-x-auto text-[11px] font-mono text-red-800 max-h-32">
                <b>Error:</b> {this.state.error.toString()}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                โหลดหน้าเว็บใหม่
              </button>
              <button
                onClick={this.handleClearAndReload}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                ล้างแคชและเริ่มใหม่
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
