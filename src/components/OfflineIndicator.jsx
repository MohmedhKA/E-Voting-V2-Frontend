import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Wifi, ShieldAlert } from 'lucide-react';
import apiClient from '../api/client';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [backendDown, setBackendDown] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  // Probe backend health
  const checkBackendHealth = async () => {
    if (!navigator.onLine) {
      setIsOffline(true);
      return;
    }

    try {
      setIsChecking(true);
      // Fast lightweight endpoint probe
      await apiClient.get('/elections/active', { timeout: 3000 });
      if (backendDown || isOffline) {
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 2500);
      }
      setBackendDown(false);
      setIsOffline(false);
    } catch (err) {
      if (!err.response) {
        setBackendDown(true);
      } else {
        setBackendDown(false);
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      checkBackendHealth();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleBackendOffline = () => {
      setBackendDown(true);
    };

    const handleBackendOnline = () => {
      if (backendDown) {
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 2500);
      }
      setBackendDown(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('backend-offline', handleBackendOffline);
    window.addEventListener('backend-online', handleBackendOnline);

    // Immediate check on mount
    checkBackendHealth();

    // Polling check every 4 seconds
    const interval = setInterval(() => {
      checkBackendHealth();
    }, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('backend-offline', handleBackendOffline);
      window.removeEventListener('backend-online', handleBackendOnline);
      clearInterval(interval);
    };
  }, [backendDown]);

  const shouldShow = isOffline || backendDown || justReconnected;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        >
          {justReconnected ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-emerald-200 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center text-slate-900 relative overflow-hidden"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm">
                <Wifi className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Connection Restored</h3>
              <p className="text-sm text-slate-600 mt-1">
                Secure cryptographic link to the blockchain network is active.
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center text-slate-900 relative overflow-hidden"
            >
              {/* Background ambient glow */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Pulsing WifiOff Icon */}
              <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-60" style={{ animationDuration: '3s' }} />
                <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center shadow-sm">
                  <WifiOff className="w-8 h-8 text-red-500 animate-pulse" style={{ animationDuration: '2s' }} />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-800 mb-3">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>{isOffline ? 'Local Network Offline' : 'Backend Unreachable'}</span>
              </div>

              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {isOffline ? 'Internet Disconnected' : 'Blockchain Server Offline'}
              </h3>

              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {isOffline
                  ? 'Your terminal has lost its network connection. Please check your Wi-Fi or Ethernet cable.'
                  : 'Unable to establish a secure cryptographic handshake with the Election Blockchain Network.'}
              </p>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={checkBackendHealth}
                  disabled={isChecking}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                  {isChecking ? 'Checking Link...' : 'Retry Connection'}
                </button>
              </div>

              <div className="mt-4 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Auto-reconnecting every 4 seconds</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
