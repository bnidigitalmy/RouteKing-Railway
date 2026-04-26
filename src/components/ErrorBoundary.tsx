import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-24 h-24 bg-red-100 rounded-[2.5rem] flex items-center justify-center text-red-600 shadow-xl shadow-red-50">
                <AlertCircle size={48} />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Opps! Sesuatu Tak Kena</h1>
                <p className="text-gray-500 font-medium">Aplikasi mengalami gangguan teknis yang tidak dijangka.</p>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-3xl border-2 border-gray-100 text-left">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Maklumat Error</p>
              <p className="text-xs font-mono text-gray-600 break-words leading-relaxed">
                {this.state.error?.message || 'Berror tidak diketahui'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
              >
                <RefreshCw size={20} />
                CUBA LAGI
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-black py-4 px-6 rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
              >
                <Home size={20} />
                UTAMA
              </button>
            </div>
            
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-4">
              Sila hubungi sokongan jika masalah berlarutan.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
