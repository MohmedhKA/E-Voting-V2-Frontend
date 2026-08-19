import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart2, RefreshCw, Trophy, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export default function ResultsModal({ isOpen, onClose, electionId: propElectionId, results: propResults, isLoading: propIsLoading }) {
  const [endedElections, setEndedElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState(propElectionId || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [results, setResults] = useState(propResults || {});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // 1. Fetch ended elections when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchEndedElections = async () => {
      try {
        const res = await apiClient.get('/elections/ended');
        if (res.data.success && Array.isArray(res.data.data)) {
          // Deduplicate by ID
          const map = new Map();
          res.data.data.forEach(e => {
            const id = e.id || e._id;
            if (id && !map.has(id)) map.set(id, e);
          });
          const list = Array.from(map.values());
          setEndedElections(list);

          // If no selected election yet or propElectionId not provided, select the first ended election
          if (!selectedElectionId && list.length > 0) {
            setSelectedElectionId(propElectionId && list.some(e => (e.id || e._id) === propElectionId) ? propElectionId : (list[0].id || list[0]._id));
          } else if (propElectionId) {
            setSelectedElectionId(propElectionId);
          }
        }
      } catch (err) {
        console.error('Failed to load ended elections:', err);
      }
    };

    fetchEndedElections();
  }, [isOpen, propElectionId]);

  // 2. Fetch results whenever selectedElectionId changes or manual refresh is clicked
  const fetchResults = async (targetId = selectedElectionId) => {
    if (!targetId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.get(`/votes/${targetId}`);

      if (res.data.success) {
        let candidateVotes = {};
        const data = res.data.data;

        if (data?.results && typeof data.results === 'object') {
          candidateVotes = data.results;
        } else if (data?.candidateVotes && typeof data.candidateVotes === 'object') {
          candidateVotes = data.candidateVotes;
        } else if (res.data.results && typeof res.data.results === 'object') {
          candidateVotes = res.data.results;
        } else if (data && typeof data === 'object' && !data.electionId && !data.totalVotes) {
          candidateVotes = data;
        }

        setResults(candidateVotes);
        setLastUpdated(new Date());
      } else {
        setError(res.data.message || 'Failed to fetch results');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Election results not found');
      } else {
        setError(err.response?.data?.message || 'Failed to load results');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedElectionId && !propResults) {
      fetchResults(selectedElectionId);
    }
  }, [isOpen, selectedElectionId]);

  // Sync propResults if passed from AdminDashboard
  useEffect(() => {
    if (propResults) {
      setResults(propResults);
      setLastUpdated(new Date());
    }
  }, [propResults]);

  const selectedElectionObj = endedElections.find(e => (e.id || e._id) === selectedElectionId);
  const totalVotes = Object.values(results).reduce((a, b) => (parseInt(a, 10) || 0) + (parseInt(b, 10) || 0), 0);

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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 m-auto z-50 w-[92%] max-w-2xl h-fit max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <BarChart2 className="text-blue-600 w-6 h-6" />
                  Live Results
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-gray-500 text-xs sm:text-sm">Certified Post-Quantum Blockchain Tally</p>
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">
                      • {lastUpdated.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchResults(selectedElectionId)}
                  disabled={isLoading || !selectedElectionId}
                  title="Refresh results"
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 disabled:opacity-40"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading || propIsLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Ended Election Selector Dropdown (with Scroll feature) */}
            {endedElections.length > 0 && (
              <div className="px-6 pt-4 pb-2 bg-gray-50/80 border-b border-gray-100">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Select Concluded Election
                </label>
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-left hover:border-blue-500 transition-colors shadow-sm"
                  >
                    <span className="font-semibold text-gray-800 truncate text-sm">
                      {selectedElectionObj ? (selectedElectionObj.title || selectedElectionObj.id) : (selectedElectionId || 'Choose an election...')}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden max-h-60 overflow-y-auto"
                      >
                        {endedElections.map(election => {
                          const id = election.id || election._id;
                          const isSelected = id === selectedElectionId;
                          return (
                            <div
                              key={id}
                              onClick={() => {
                                setSelectedElectionId(id);
                                setIsDropdownOpen(false);
                              }}
                              className={`px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 ${
                                isSelected ? 'bg-blue-50/60 font-semibold' : ''
                              }`}
                            >
                              <div>
                                <div className="text-sm text-gray-900 font-medium">{election.title || id}</div>
                                <div className="text-xs text-gray-400">ID: {id}</div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Content Body */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-gray-800">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                  <button
                    onClick={() => fetchResults(selectedElectionId)}
                    className="ml-3 px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {endedElections.length === 0 && !selectedElectionId ? (
                <div className="text-center py-12 text-gray-400">
                  <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold text-gray-600 text-base mb-1">No Concluded Elections Found</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Results are cryptographically tallied and published after an election has been officially concluded.
                  </p>
                </div>
              ) : Object.keys(results).length > 0 ? (
                <div className="space-y-5">
                  {Object.entries(results)
                    .sort(([, a], [, b]) => b - a)
                    .map(([candidate, count], index) => {
                      const numCount = parseInt(count, 10) || 0;
                      const percentage = totalVotes === 0 ? 0 : Math.round((numCount / totalVotes) * 100);
                      const colors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-indigo-500', 'bg-teal-500'];
                      const colorClass = colors[index % colors.length];

                      return (
                        <div key={candidate} className="relative bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                          <div className="flex justify-between items-center mb-2 font-semibold text-sm">
                            <span className="flex items-center gap-2 text-gray-900">
                              {index === 0 && totalVotes > 0 && (
                                <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              )}
                              {candidate}
                            </span>
                            <span className="text-gray-700">
                              {numCount.toLocaleString()} Votes ({percentage}%)
                            </span>
                          </div>

                          <div className="h-3.5 w-full bg-gray-200 rounded-full overflow-hidden">
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
                      {totalVotes.toLocaleString()}
                    </motion.span>
                    <p className="text-gray-500 uppercase tracking-widest text-xs font-bold mt-1">
                      Total Valid Votes Cast
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  {isLoading || propIsLoading ? (
                    <>
                      <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin opacity-50 text-blue-600" />
                      <p className="text-sm font-medium">Deciphering blockchain tally...</p>
                    </>
                  ) : (
                    <>
                      <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-medium text-gray-600">No votes recorded for this election</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Hyperledger Fabric + Homomorphic Decryption</span>
              <span className="font-semibold text-green-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Certified Final
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
