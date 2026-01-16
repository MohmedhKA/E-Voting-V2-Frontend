import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export default function ResultsModal({ isOpen, onClose, electionId }) {
  const [results, setResults] = useState({});
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch results function
  const fetchResults = async () => {
    console.log('📊 fetchResults called, electionId:', electionId);

    if (!electionId) {
      setError('No election ID provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📡 Calling API: GET /votes/' + electionId);
      const res = await apiClient.get(`/votes/${electionId}`);
      
      console.log('✅ API Response:', res.data);
      
      if (res.data.success) {
        // Parse response - handle multiple backend formats
        let candidateVotes = {};
        
        // 🔧 FIX: Check for nested results first!
        if (res.data.data?.results) {
          // Format: { success, data: { electionId, results: { KVT: 1, DMK: 0 }, totalVotes } }
          candidateVotes = res.data.data.results;
        } else if (res.data.data?.candidateVotes) {
          // Format: { success, data: { candidateVotes: { KVT: 1, DMK: 0 } } }
          candidateVotes = res.data.data.candidateVotes;
        } else if (res.data.candidateVotes) {
          // Format: { success, candidateVotes: { KVT: 1, DMK: 0 } }
          candidateVotes = res.data.candidateVotes;
        } else if (res.data.results) {
          // Format: { success, results: { KVT: 1, DMK: 0 } }
          candidateVotes = res.data.results;
        } else if (typeof res.data.data === 'object' && !res.data.data.electionId && !res.data.data.totalVotes) {
          // Format: { success, data: { KVT: 1, DMK: 0 } } (direct votes object)
          candidateVotes = res.data.data;
        }
        
        console.log('📊 Parsed votes:', candidateVotes);
        console.log('📊 Vote entries:', Object.entries(candidateVotes));
        
        setResults(candidateVotes);
        setLastUpdated(new Date());
      } else {
        setError(res.data.message || 'Failed to fetch results');
      }
    } catch (err) {
      console.error('❌ Fetch error:', err);
      
      if (err.response?.status === 403) {
        setError('Access denied - Results endpoint requires authentication');
      } else if (err.response?.status === 404) {
        setError('Election not found');
      } else {
        setError(err.response?.data?.message || 'Failed to load results');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    console.log('🔵 useEffect [isOpen, electionId]:', { isOpen, electionId });
    if (isOpen && electionId) {
      console.log('✅ Fetching results...');
      fetchResults();
    }
  }, [isOpen, electionId]);

  // Auto-refresh
  useEffect(() => {
    if (!isOpen || !isAutoRefresh || !electionId) {
      return;
    }

    const interval = setInterval(() => {
      fetchResults();
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, isAutoRefresh, electionId]);

  const totalVotes = Object.values(results).reduce((a, b) => a + b, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

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
                  {isAutoRefresh ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Wifi className="w-3 h-3" />
                      Live
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                      <WifiOff className="w-3 h-3" />
                      Paused
                    </span>
                  )}
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">
                      • {lastUpdated.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isAutoRefresh
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {isAutoRefresh ? '🔄 Auto' : '⏸️ Paused'}
                </button>

                <button
                  onClick={fetchResults}
                  disabled={isLoading}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto text-gray-800">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center justify-between">
                  <span>{error}</span>
                  <button
                    onClick={fetchResults}
                    className="ml-3 px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}

              {Object.keys(results).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(results)
                    .sort(([, a], [, b]) => b - a)
                    .map(([candidate, count], index) => {
                      const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
                      const colors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500'];
                      const colorClass = colors[index % colors.length];

                      return (
                        <div key={candidate} className="relative">
                          <div className="flex justify-between mb-2 font-semibold">
                            <span className="flex items-center gap-2">
                              {index === 0 && totalVotes > 0 && <span>🏆</span>}
                              {candidate}
                            </span>
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
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-12 h-12 mx-auto mb-3 animate-spin opacity-50" />
                      <p>Loading results...</p>
                    </>
                  ) : (
                    <>
                      <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No votes cast yet</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                {isAutoRefresh ? (
                  <>🔄 Auto-refreshing every 3 seconds</>
                ) : (
                  <>⏸️ Auto-refresh paused</>
                )}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
