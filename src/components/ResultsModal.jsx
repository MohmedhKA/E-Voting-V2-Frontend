import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart2, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ResultsModal({ isOpen, onClose, electionId, apiBaseUrl = 'http://localhost:3000' }) {
  const [results, setResults] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !electionId) {
      return;
    }

    let eventSource;

    try {
      const url = `${apiBaseUrl}/api/v1/votes/stream/${electionId}`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setResults(data);
        } catch (err) {
          console.error('[SSE] Parse error:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        setIsConnected(false);
        setError('Connection lost. Check console for details.');
      };
    } catch (err) {
      setError(`Connection failed: ${err.message}`);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      setIsConnected(false);
    };
  }, [isOpen, electionId, apiBaseUrl]);

  const totalVotes = results ? Object.values(results).reduce((a, b) => a + b, 0) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* White Stats Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 m-auto z-50 w-[90%] max-w-2xl h-fit max-h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <BarChart2 className="text-blue-600" />
                  Live Results
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-gray-500 text-sm">Real-time blockchain tally</p>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Wifi className="w-3 h-3" />
                      Live
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                      <WifiOff className="w-3 h-3" />
                      Disconnected
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-8 overflow-y-auto text-gray-800">
              {error && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                  {error}
                </div>
              )}

              {results && Object.keys(results).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(results).map(([candidate, count], index) => {
                    const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);

                    const colors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500'];
                    const colorClass = colors[index % colors.length];

                    return (
                      <div key={candidate} className="relative">
                        <div className="flex justify-between mb-2 font-semibold">
                          <span>{candidate}</span>
                          <span>{count} Votes ({percentage}%)</span>
                        </div>

                        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className={`h-full ${colorClass} rounded-full shadow-sm`}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <motion.span
                      key={totalVotes}
                      initial={{ scale: 1.2, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-4xl font-black text-gray-900"
                    >
                      {totalVotes}
                    </motion.span>
                    <p className="text-gray-500 uppercase tracking-widest text-xs font-bold mt-1">
                      Total Votes Cast
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>No votes cast yet or election not active.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}