"use client";

interface PriceStatusProps {
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onRefresh?: () => void;
}

export default function PriceStatus({ loading, error, lastUpdated, onRefresh }: PriceStatusProps) {
  const getStatusIcon = () => {
    if (loading) {
      return (
        <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full" />
      );
    }
    
    if (error) {
      return (
        <svg className="h-3 w-3 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      );
    }
    
    return (
      <svg className="h-3 w-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="20,6 9,17 4,12"/>
      </svg>
    );
  };

  const getStatusText = () => {
    if (loading) return 'Mise à jour...';
    if (error) return 'Erreur de synchronisation';
    if (lastUpdated) {
      const now = new Date();
      const diffMs = now.getTime() - lastUpdated.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      
      if (diffSec < 60) return 'Mis à jour maintenant';
      if (diffSec < 3600) return `Mis à jour il y a ${Math.floor(diffSec / 60)}min`;
      return `Mis à jour il y a ${Math.floor(diffSec / 3600)}h`;
    }
    return 'En attente...';
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {getStatusIcon()}
      <span className={error ? 'text-red-600' : ''}>{getStatusText()}</span>
      {onRefresh && !loading && (
        <button
          onClick={onRefresh}
          className="ml-1 p-0.5 hover:bg-gray-100 rounded transition-colors"
          title="Actualiser les prix"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="23,4 23,10 17,10"/>
            <polyline points="1,20 1,14 7,14"/>
            <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4L18.36,18.36A9,9,0,0,1,3.51,15"/>
          </svg>
        </button>
      )}
      {error && (
        <div className="ml-2 text-[10px] text-red-500 max-w-40 truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  );
}
