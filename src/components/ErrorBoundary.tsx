import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorInfo: string | null }> {
  public state: { hasError: boolean; errorInfo: string | null } = { hasError: false, errorInfo: null };

  constructor(props: { children: ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold">Algo salió mal</h2>
            <p className="text-gray-600 text-sm">{this.state.errorInfo}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-all"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}
