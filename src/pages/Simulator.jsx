/**
 * @fileoverview Performance Simulator - Production Mode Only
 * @description Clean, production-grade testing with async polling
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Terminal, Play, StopCircle, TrendingUp, Clock, 
  Database, CheckCircle, XCircle, Activity, Cpu, Timer,
  BarChart3, Shield, Gauge, AlertCircle
} from 'lucide-react';
import apiClient from '../api/client';
import testingClient from '../api/testingClient';

export default function Simulator() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [voteCount, setVoteCount] = useState(100);
  const [timeout, setTimeout] = useState(300);
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [liveStats, setLiveStats] = useState({ confirmed: 0, failed: 0, queued: 0 });
  
  const [finalMetrics, setFinalMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // ✅ NEW: refs for polling control
  const pollingRef = useRef(null);
  const stopRef = useRef(false);
  const startTimeRef = useRef(0);
  
  // ==========================================
  // INITIALIZATION
  // ==========================================
  
  useEffect(() => {
    apiClient
      .get('/elections/active')
      .then((res) => {
        if (res.data.success) {
          setElections(res.data.data);
          addLog('✅ Loaded active elections', 'success');
        }
      })
      .catch((err) => {
        addLog(`❌ Failed to load elections: ${err.message}`, 'error');
      });

    // Cleanup polling on unmount
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);
  
  // ==========================================
  // LOGGING
  // ==========================================
  
  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = { error: '❌', success: '✅', warning: '⚠️', info: 'ℹ️' }[type] || 'ℹ️';
    setLogs(prev => [{ msg: `[${timestamp}] ${emoji} ${msg}`, type }, ...prev].slice(0, 150));
  };
  
  const clearLogs = () => setLogs([]);
  
  // ==========================================
  // ✅ NEW: ASYNC POLLING SIMULATION
  // ==========================================
  
  const startSimulation = async () => {
    if (!selectedElection) {
      addLog('Select an election first!', 'error');
      return;
    }
    
    const electionObj = elections.find(e => e.id === selectedElection);
    const candidates = electionObj?.candidates || [];
    
    if (!candidates.length) {
      addLog('No candidates found for selected election!', 'error');
      return;
    }
    
    // Reset state
    stopRef.current = false;
    setIsRunning(true);
    setProgress(0);
    setCurrentPhase('queuing');
    setFinalMetrics(null);
    setLiveStats({ confirmed: 0, failed: 0, queued: 0 });
    clearLogs();
    startTimeRef.current = Date.now();
    
    addLog('═══════════════════════════════════════', 'info');
    addLog('🚀 PRODUCTION SIMULATION STARTING', 'success');
    addLog('═══════════════════════════════════════', 'info');
    addLog(`📊 Election: ${electionObj.title}`, 'info');
    addLog(`📊 Total votes: ${voteCount}`, 'info');
    addLog(`📊 Timeout: ${timeout}s`, 'info');
    addLog(`📊 Candidates: ${candidates.length}`, 'info');
    addLog('', 'info');
    
    try {
      const candidateIds = candidates.map(c => typeof c === 'string' ? c : c.id);
      
      addLog('📤 Sending request to backend...', 'info');
      
      // ✅ STEP 1: Fire request — returns jobId immediately (no timeout risk)
      const startResponse = await testingClient.post('/simulate', {
        voteCount,
        electionId: selectedElection,
        candidates: candidateIds,
        timeout: timeout * 1000
      });
      
      if (!startResponse.data.success) {
        addLog(`Failed to start: ${startResponse.data.message}`, 'error');
        setIsRunning(false);
        setCurrentPhase('idle');
        return;
      }
      
      const { jobId } = startResponse.data;
      addLog(`✅ Simulation started! Job: ${jobId.substring(0, 20)}...`, 'success');
      addLog('⏳ Polling for live progress every 2s...', 'info');
      addLog('', 'info');
      
      setCurrentPhase('confirming');
      
      // ✅ STEP 2: Poll every 2 seconds
      pollingRef.current = setInterval(async () => {
        
        // User hit stop
        if (stopRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          addLog('⏹️ Polling stopped by user', 'warning');
          setIsRunning(false);
          setCurrentPhase('idle');
          return;
        }
        
        try {
          const { data } = await testingClient.get(`/status/${jobId}`);
          const job = data.data;
          
          // Update live stats
          setLiveStats({
            confirmed: job.confirmed || 0,
            failed: job.failed || 0,
            queued: job.queued || voteCount
          });
          
          // Update progress bar
          const pct = job.queued > 0
            ? Math.round(((job.confirmed + job.failed) / job.queued) * 100)
            : 0;
          setProgress(Math.min(pct, 99)); // hold at 99 until COMPLETE
          
          // Phase label
          if (job.phase === 'QUEUING') setCurrentPhase('queuing');
          else if (job.phase === 'CONFIRMING') setCurrentPhase('confirming');
          
          // Log progress snapshot
          addLog(
            `Progress: ${job.confirmed || 0} confirmed | ${job.failed || 0} failed | ${job.queued || 0} queued`,
            'info'
          );
          
          // ✅ STEP 3: Simulation complete
          if (job.status === 'COMPLETE') {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            
            setProgress(100);
            setCurrentPhase('complete');
            setIsRunning(false);
            
            // Build finalMetrics in the same shape the UI expects
            const metrics = {
              totalRequested: voteCount,
              queued:         job.queued        ?? voteCount,
              confirmed:      job.confirmed     ?? 0,
              failed:         job.failed        ?? 0,
              pending:        job.pending       ?? 0,
              queueFailed:    job.queueFailed   ?? 0,
              successRate:    job.successRate   ?? 0,
              throughput:     job.throughput    ?? 0,
              avgConfirmation:job.avgConfirmation ?? 0,
              totalTime:      job.totalTime     ?? (Date.now() - startTimeRef.current),
              queueTime:      0, // not tracked separately in new flow
              confirmationTime: job.totalTime   ?? 0,
              completed:      true,
              timedOut:       (job.pending ?? 0) > 0
            };
            
            setFinalMetrics(metrics);
            
            addLog('', 'info');
            addLog('═══════════════════════════════════════', 'info');
            addLog('🏁 SIMULATION COMPLETE!', 'success');
            addLog('═══════════════════════════════════════', 'info');
            addLog(`   • Confirmed:    ${metrics.confirmed}`, 'success');
            addLog(`   • Failed:       ${metrics.failed}`, metrics.failed > 0 ? 'error' : 'info');
            addLog(`   • Pending:      ${metrics.pending}`, metrics.pending > 0 ? 'warning' : 'info');
            addLog(`   • Success rate: ${metrics.successRate}%`, 'success');
            addLog(`   • Throughput:   ${metrics.throughput} votes/sec`, 'success');
            addLog(`   • Total time:   ${(metrics.totalTime / 1000).toFixed(2)}s`, 'info');
            addLog('═══════════════════════════════════════', 'info');
          }
          
        } catch (pollErr) {
          addLog(`Poll error: ${pollErr.message}`, 'warning');
        }
        
      }, 2000); // poll every 2 seconds
      
    } catch (error) {
      addLog(`Simulation error: ${error.message}`, 'error');
      if (error.response) {
        addLog(`Server: ${JSON.stringify(error.response.data)}`, 'error');
      }
      setIsRunning(false);
      setCurrentPhase('idle');
    }
  };
  
  const stopSimulation = () => {
    stopRef.current = true;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    addLog('⏹️ Stopped polling (backend may still process)', 'warning');
    setIsRunning(false);
    setCurrentPhase('idle');
  };
  
  const resetSimulation = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setProgress(0);
    setFinalMetrics(null);
    setCurrentPhase('idle');
    setLiveStats({ confirmed: 0, failed: 0, queued: 0 });
    clearLogs();
    addLog('🔄 Simulation reset', 'info');
  };
  
  // ==========================================
  // RENDER
  // ==========================================
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-green-400 font-mono p-4 md:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-8 h-8 text-green-500 animate-pulse" />
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-widest bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
            Production Simulator
          </h1>
        </div>
        <p className="text-green-600 text-sm">
          Complete E2E Testing • Real Signatures • PDC Audit • Blockchain Confirmation
        </p>
      </motion.div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: CONTROLS */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="border border-green-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,0,0.1)]"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-bold uppercase">Configuration</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-green-600 mb-2">Target Election</label>
                <select
                  value={selectedElection}
                  onChange={(e) => setSelectedElection(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-black/50 border border-green-500/50 rounded-lg px-3 py-2 text-green-300 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">-- SELECT ELECTION --</option>
                  {elections.map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>
              
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-bold text-purple-300 uppercase">Production Mode</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  ✅ Complete flow with:<br />
                  • Dilithium-3 blind signatures<br />
                  • PDC audit log writes<br />
                  • Queue ingestion<br />
                  • Blockchain confirmation tracking
                </p>
              </div>
              
              <div>
                <label className="block text-xs uppercase text-green-600 mb-2">
                  Vote Count: <span className="text-green-400 font-bold text-lg">{voteCount}</span>
                </label>
                <input
                  type="range" min="10" max="3000" step="10"
                  value={voteCount}
                  onChange={(e) => setVoteCount(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>10</span><span>1500</span><span>3000</span>
                </div>
              </div>
              
              <div>
                <label className="block text-xs uppercase text-green-600 mb-2">
                  Timeout: <span className="text-cyan-400 font-bold text-lg">{timeout}s</span>
                </label>
                <input
                  type="range" min="60" max="600" step="30"
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>1m</span><span>5m</span><span>10m</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              {!isRunning ? (
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={startSimulation}
                  disabled={!selectedElection}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 text-black font-bold py-4 rounded-lg hover:from-green-500 hover:to-green-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/50"
                >
                  <Play className="w-5 h-5" />
                  START SIMULATION
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={stopSimulation}
                  className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white font-bold py-4 rounded-lg hover:from-red-500 hover:to-red-400 transition-all flex items-center justify-center gap-2 animate-pulse shadow-lg shadow-red-500/50"
                >
                  <StopCircle className="w-5 h-5" />
                  STOP POLLING
                </motion.button>
              )}
              
              <button
                onClick={resetSimulation}
                disabled={isRunning}
                className="w-full bg-gray-800 border border-gray-700 text-green-400 font-semibold py-3 rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Reset
              </button>
            </div>
          </motion.div>
          
          {/* ✅ Live stat cards — update during polling */}
          {(isRunning || finalMetrics) && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 gap-3"
            >
              <StatCard icon={<Database className="w-5 h-5" />} label="Queued"
                value={finalMetrics?.queued ?? liveStats.queued} color="green" />
              <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Confirmed"
                value={finalMetrics?.confirmed ?? liveStats.confirmed} color="cyan" />
              <StatCard icon={<XCircle className="w-5 h-5" />} label="Failed"
                value={finalMetrics ? (finalMetrics.failed + finalMetrics.queueFailed) : liveStats.failed} color="red" />
              <StatCard icon={<Clock className="w-5 h-5" />} label="Pending"
                value={finalMetrics?.pending ?? Math.max(0, liveStats.queued - liveStats.confirmed - liveStats.failed)} color="yellow" />
            </motion.div>
          )}
        </div>
        
        {/* MIDDLE COLUMN: PROGRESS & METRICS */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-green-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase text-green-400 flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                {currentPhase === 'queuing'    ? 'Queuing Votes...'
                 : currentPhase === 'confirming' ? 'Waiting for Confirmations...'
                 : currentPhase === 'complete'   ? 'Complete'
                 : 'Ready'}
              </h3>
              <span className="text-2xl font-bold text-green-400">{progress}%</span>
            </div>
            
            <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 via-green-500 to-cyan-500 shadow-lg"
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference z-10">
                {progress < 100 ? `${progress}% PROCESSING` : '✓ COMPLETE'}
              </div>
            </div>
            
            {isRunning && (
              <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400">
                <AlertCircle className="w-4 h-4 animate-pulse" />
                Polling backend every 2s — no timeout risk 🎯
              </div>
            )}
          </motion.div>
          
          {finalMetrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border border-cyan-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-cyan-500" />
                <h3 className="text-sm font-bold uppercase text-cyan-400">Final Metrics</h3>
              </div>
              
              <div className="space-y-3">
                <MetricRow label="Overall Throughput" value={`${finalMetrics.throughput} votes/sec`}
                  sublabel="End-to-end processing rate" icon={<Gauge className="w-4 h-4" />} />
                <MetricRow label="Success Rate" value={`${finalMetrics.successRate}%`}
                  sublabel={`${finalMetrics.confirmed} of ${finalMetrics.queued} confirmed`} icon={<CheckCircle className="w-4 h-4" />} />
                <MetricRow label="PDC Audit" value="Background Process"
                  sublabel="Non-blocking async worker" icon={<Shield className="w-4 h-4" />} />
                <MetricRow label="Avg Confirmation" value={`${finalMetrics.avgConfirmation}ms`}
                  sublabel="Queue to confirmed time" icon={<Timer className="w-4 h-4" />} />
                <MetricRow label="Total Time" value={`${(finalMetrics.totalTime / 1000).toFixed(2)}s`}
                  sublabel="Wall clock, start to finish" icon={<Clock className="w-4 h-4" />} />
              </div>
            </motion.div>
          )}
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="border border-purple-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <h3 className="text-sm font-bold uppercase text-purple-400">Summary</h3>
            </div>
            
            {finalMetrics ? (
              <div className="space-y-2 text-sm">
                <SummaryRow label="Total Requested"      value={finalMetrics.totalRequested} />
                <SummaryRow label="Successfully Queued"  value={finalMetrics.queued}     color="green" />
                <SummaryRow label="Blockchain Confirmed" value={finalMetrics.confirmed}   color="cyan" />
                <SummaryRow label="Failed"               value={finalMetrics.failed}      color={finalMetrics.failed > 0 ? 'red' : 'gray'} />
                <SummaryRow label="Queue Failures"       value={finalMetrics.queueFailed} color={finalMetrics.queueFailed > 0 ? 'red' : 'gray'} />
                <SummaryRow label="Still Pending"        value={finalMetrics.pending}     color={finalMetrics.pending > 0 ? 'yellow' : 'gray'} />
                
                {finalMetrics.timedOut && (
                  <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-xs text-yellow-400">
                    ⚠️ Some votes timed out before confirmation
                  </div>
                )}
                {!finalMetrics.timedOut && (
                  <div className="mt-3 p-2 bg-green-900/20 border border-green-500/30 rounded text-xs text-green-400">
                    ✅ All votes processed successfully!
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <Cpu className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Run simulation to see results</p>
              </div>
            )}
          </motion.div>
        </div>
        
        {/* RIGHT COLUMN: TERMINAL LOGS */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-green-500/30 rounded-xl bg-black/80 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,0,0.1)] flex flex-col"
        >
          <div className="flex items-center justify-between border-b border-green-500/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-500" />
              <span className="text-xs uppercase text-green-600 font-bold">System Output</span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto font-mono text-sm space-y-1 max-h-[calc(100vh-250px)] scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-gray-900">
            <AnimatePresence initial={false}>
              {logs.map((log, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`border-l-2 pl-2 py-0.5 ${
                    log.type === 'error'   ? 'border-red-500/50 text-red-400'
                    : log.type === 'success' ? 'border-green-500/50 text-green-400'
                    : log.type === 'warning' ? 'border-yellow-500/50 text-yellow-400'
                    : 'border-green-500/20 text-green-500'
                  }`}
                >
                  {log.msg}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {logs.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-700">
                <div className="text-center">
                  <Terminal className="w-12 h-12 mx-auto mb-2 opacity-30 animate-pulse" />
                  <p className="text-sm uppercase tracking-wider">Awaiting Input...</p>
                  <p className="text-xs mt-1 opacity-60">Configure and start simulation</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ==========================================
// HELPER COMPONENTS — UNCHANGED
// ==========================================

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    green:  'border-green-500/30 bg-green-900/10 text-green-400',
    cyan:   'border-cyan-500/30 bg-cyan-900/10 text-cyan-400',
    red:    'border-red-500/30 bg-red-900/10 text-red-400',
    yellow: 'border-yellow-500/30 bg-yellow-900/10 text-yellow-400',
  };
  return (
    <motion.div whileHover={{ scale: 1.05 }} className={`border rounded-lg p-4 transition-all ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1 opacity-70">
        {icon}
        <span className="text-xs uppercase font-semibold">{label}</span>
      </div>
      <div className="text-2xl font-bold">{Number(value).toLocaleString()}</div>
    </motion.div>
  );
}

function MetricRow({ label, value, sublabel, icon }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-800/50 last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-500 uppercase mb-1">{icon}{label}</div>
        {sublabel && <div className="text-xs text-gray-700 mt-0.5">{sublabel}</div>}
      </div>
      <div className="text-lg font-bold text-cyan-400 ml-4">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value, color = 'gray' }) {
  const colorClasses = {
    green: 'text-green-400', cyan: 'text-cyan-400', red: 'text-red-400',
    yellow: 'text-yellow-400', gray: 'text-gray-400'
  };
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-800">
      <span className="text-gray-500">{label}:</span>
      <span className={`font-bold ${colorClasses[color]}`}>{value}</span>
    </div>
  );
}
