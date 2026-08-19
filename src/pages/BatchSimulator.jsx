/**
 * @fileoverview Batch Performance Simulator
 * @description Runs consecutive simulations automatically for testing.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Terminal, Play, StopCircle, TrendingUp, Clock, 
  Database, CheckCircle, XCircle, Activity, Cpu, Timer,
  BarChart3, Shield, Gauge, AlertCircle, Layers, Download
} from 'lucide-react';
import apiClient from '../api/client';
import testingClient from '../api/testingClient';
import MatrixBackground from '../components/MatrixBackground';

// Reusing helper functions from Simulator.jsx
function generateElectionWeights(count) {
  const baseProfiles = {
    1: [1.00],
    2: [0.58, 0.42],
    3: [0.48, 0.31, 0.21],
    4: [0.40, 0.27, 0.20, 0.13],
    5: [0.36, 0.25, 0.18, 0.13, 0.08],
    6: [0.32, 0.23, 0.17, 0.13, 0.09, 0.06],
    7: [0.30, 0.21, 0.16, 0.12, 0.09, 0.07, 0.05],
    8: [0.28, 0.20, 0.15, 0.12, 0.09, 0.07, 0.05, 0.04],
  };

  const base = baseProfiles[count] || (() => {
    const weights = Array.from({ length: count }, (_, i) => Math.pow(0.75, i));
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => w / sum);
  })();

  const noisy = base.map(w => Math.max(0.01, w + (Math.random() * 0.06 - 0.03)));

  for (let i = noisy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [noisy[i], noisy[j]] = [noisy[j], noisy[i]];
  }

  const total = noisy.reduce((a, b) => a + b, 0);
  return noisy.map(w => w / total);
}

function buildWeightedCandidatePool(candidates, weights) {
  const pool = [];
  const POOL_SIZE = 1000;

  candidates.forEach((c, i) => {
    const id = typeof c === 'string' ? c : c.id;
    const count = Math.round(weights[i] * POOL_SIZE);
    for (let j = 0; j < count; j++) pool.push(id);
  });

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool;
}

export default function BatchSimulator() {
  // Config State
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState('');
  
  const [batchCount, setBatchCount] = useState(5);
  const [batchVotes, setBatchVotes] = useState([5000, 4000, 3000, 2000, 1000]);
  const [repeatCount, setRepeatCount] = useState(5);
  const [waitTime, setWaitTime] = useState(30); // 30 seconds default
  const [timeout, setTimeout] = useState(300); // 300s default timeout
  
  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [liveStats, setLiveStats] = useState({ confirmed: 0, failed: 0, queued: 0 });
  const [currentRep, setCurrentRep] = useState(0);
  const [currentBatchIdx, setCurrentBatchIdx] = useState(0);
  
  const [finalMetrics, setFinalMetrics] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const stopRef = useRef(false);
  const logsEndRef = useRef(null);
  const activeJobIdRef = useRef(null);
  const waitTimeoutRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Load elections
  useEffect(() => {
    apiClient
      .get('/elections/active')
      .then((res) => {
        if (res.data.success) {
          setElections(res.data.data);
          addLog('Elections loaded', 'success');
        }
      })
      .catch((err) => {
        addLog(`Failed to load elections: ${err.message}`, 'error');
      });

    return () => {
      stopRef.current = true;
      if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
    };
  }, []);

  const handleBatchCountChange = (count) => {
    const num = Math.max(1, parseInt(count) || 1);
    setBatchCount(num);
    setBatchVotes(prev => {
      const newVotes = [...prev];
      while (newVotes.length < num) newVotes.push(100);
      return newVotes.slice(0, num);
    });
  };

  const handleBatchVoteChange = (index, value) => {
    setBatchVotes(prev => {
      const newVotes = [...prev];
      newVotes[index] = Math.max(1, parseInt(value) || 1);
      return newVotes;
    });
  };

  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { msg: `[${timestamp}] ${msg}`, type }].slice(-150));
  };
  
  const clearLogs = () => setLogs([]);

  // Async delay helper
  const delay = (ms) => new Promise(resolve => {
    waitTimeoutRef.current = globalThis.setTimeout(resolve, ms);
  });

  // Run single simulation cycle and return metrics
  const runSimulationCycle = async (voteCountToRun, candidates) => {
    const startTime = Date.now();
    
    const weights = generateElectionWeights(candidates.length);
    const candidateIds = buildWeightedCandidatePool(candidates, weights);

    addLog(`Sending request for ${voteCountToRun} votes...`, 'info');
    
    const startResponse = await testingClient.post('/simulate', {
      voteCount: voteCountToRun,
      electionId: selectedElection,
      candidates: candidateIds,
      timeout: timeout * 1000
    });
    
    if (!startResponse.data.success) {
      throw new Error(`Failed to start: ${startResponse.data.message}`);
    }
    
    const { jobId } = startResponse.data;
    activeJobIdRef.current = jobId;
    addLog(`Job started: ${jobId.substring(0, 10)}...`, 'success');
    
    setCurrentPhase('confirming');
    
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        if (stopRef.current) {
          clearInterval(pollInterval);
          reject(new Error('Stopped by user'));
          return;
        }
        
        try {
          const { data } = await testingClient.get(`/status/${jobId}`);
          const job = data.data;
          
          setLiveStats({
            confirmed: job.confirmed || 0,
            failed: job.failed || 0,
            queued: job.queued || voteCountToRun
          });
          
          const pct = job.queued > 0
            ? Math.round(((job.confirmed + job.failed) / job.queued) * 100)
            : 0;
          setProgress(Math.min(pct, 99));
          
          if (job.phase === 'QUEUING') setCurrentPhase('queuing');
          else if (job.phase === 'CONFIRMING') setCurrentPhase('confirming');
          
          addLog(`Progress: ${job.confirmed || 0} confirmed | ${job.failed || 0} failed | ${job.queued || 0} queued`, 'info');
          
          if (job.status === 'COMPLETE') {
            clearInterval(pollInterval);
            setProgress(100);
            
            const metrics = {
              totalRequested: voteCountToRun,
              queued:          job.queued        ?? voteCountToRun,
              confirmed:       job.confirmed     ?? 0,
              failed:          job.failed        ?? 0,
              pending:         job.pending       ?? 0,
              queueFailed:     job.queueFailed   ?? 0,
              successRate:     job.successRate   ?? 0,
              throughput:      job.throughput    ?? 0,
              avgConfirmation: job.avgConfirmation ?? 0,
              totalTime:       job.totalTime     ?? (Date.now() - startTime),
              timedOut:        (job.pending ?? 0) > 0
            };
            
            resolve(metrics);
          }
        } catch (err) {
          addLog(`Poll error: ${err.message}`, 'warning');
        }
      }, 2000);
    });
  };

  const startBatchSimulation = async () => {
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
    
    stopRef.current = false;
    setIsRunning(true);
    setFinalMetrics(null);
    setAllResults([]);
    clearLogs();
    
    addLog('Batch Simulation starting', 'success');
    addLog(`Election: ${electionObj.title}`, 'info');
    addLog(`Batches: ${batchCount} | Repetitions: ${repeatCount} | Wait: ${waitTime}s`, 'info');
    
    const newAllResults = [];

    try {
      for (let rep = 1; rep <= repeatCount; rep++) {
        setCurrentRep(rep);
        addLog(`--- Starting Repetition ${rep}/${repeatCount} ---`, 'info');
        
        for (let bIdx = 0; bIdx < batchCount; bIdx++) {
          setCurrentBatchIdx(bIdx + 1);
          const currentVoteCount = batchVotes[bIdx];
          
          if (stopRef.current) throw new Error('Stopped by user');

          addLog(`=> Running Batch ${bIdx + 1}/${batchCount} (${currentVoteCount} votes)`, 'info');
          
          setProgress(0);
          setLiveStats({ confirmed: 0, failed: 0, queued: 0 });
          setCurrentPhase('queuing');

          const metrics = await runSimulationCycle(currentVoteCount, candidates);
          setFinalMetrics(metrics); // Show latest in UI

          // Store result
          newAllResults.push({ rep, batchIndex: bIdx + 1, voteCount: currentVoteCount, metrics });
          setAllResults([...newAllResults]);

          addLog(`Batch complete. Throughput: ${metrics.throughput} v/s | Confirmed: ${metrics.confirmed}`, 'success');

          // Wait before next if not the very last step
          if (!(rep === repeatCount && bIdx === batchCount - 1)) {
            setCurrentPhase('waiting');
            addLog(`Waiting ${waitTime}s before next test...`, 'warning');
            
            // Wait countdown logic for progress bar
            let timeLeft = waitTime;
            setProgress(0);
            while (timeLeft > 0) {
              if (stopRef.current) throw new Error('Stopped by user');
              await delay(1000);
              timeLeft--;
              setProgress(Math.round(((waitTime - timeLeft) / waitTime) * 100));
            }
          }
        }
      }

      addLog('All batch simulations complete!', 'success');
      setCurrentPhase('complete');
      downloadCSV(newAllResults);
      
    } catch (err) {
      if (err.message === 'Stopped by user') {
        addLog('Stopped by user', 'warning');
      } else {
        addLog(`Simulation error: ${err.message}`, 'error');
      }
      setCurrentPhase('idle');
    } finally {
      setIsRunning(false);
      activeJobIdRef.current = null;
    }
  };

  const stopSimulation = () => {
    stopRef.current = true;
    if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
    addLog('Stop requested...', 'warning');
  };

  const resetSimulation = () => {
    stopSimulation();
    setTimeout(() => {
      setProgress(0);
      setFinalMetrics(null);
      setAllResults([]);
      setCurrentPhase('idle');
      setLiveStats({ confirmed: 0, failed: 0, queued: 0 });
      setCurrentRep(0);
      setCurrentBatchIdx(0);
      clearLogs();
      addLog('Simulation reset', 'info');
      stopRef.current = false;
    }, 100); // small delay to let current loops exit
  };

  const downloadCSV = (resultsToUse = allResults) => {
    if (resultsToUse.length === 0) return;
    const reps = Math.max(...resultsToUse.map(r => r.rep));
    const batches = Math.max(...resultsToUse.map(r => r.batchIndex));

    let csvContent = "data:text/csv;charset=utf-8,";
    let header = ["Batch Votes"];
    for (let i = 1; i <= reps; i++) {
      header.push(`Rep ${i} TPS`);
    }
    header.push("Avg TPS");
    csvContent += header.join(",") + "\n";

    for (let b = 1; b <= batches; b++) {
      const batchResults = resultsToUse.filter(r => r.batchIndex === b);
      if (batchResults.length === 0) continue;
      const voteCount = batchResults[0].voteCount;
      let row = [voteCount];
      let sumTPS = 0;
      for (let r = 1; r <= reps; r++) {
        const res = batchResults.find(res => res.rep === r);
        const tps = res ? res.metrics.throughput : "";
        row.push(tps);
        if (res) sumTPS += Number(tps);
      }
      const avgTPS = (sumTPS / batchResults.length).toFixed(2);
      row.push(avgTPS);
      csvContent += row.join(",") + "\n";
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "tps_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-green-400 font-mono flex flex-col overflow-hidden">
      <MatrixBackground />
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 px-4 md:px-8 pt-4 pb-3"
      >
        <div className="flex items-center gap-3 mb-1">
          <Layers className="w-8 h-8 text-green-500 animate-pulse" />
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-widest bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
            Batch Simulator
          </h1>
        </div>
        <p className="text-green-600 text-sm">
          Automated multi-batch E2E performance testing
        </p>
      </motion.div>
      
      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 md:px-8 pb-4 min-h-0">
        
        {/* LEFT COLUMN: Config */}
        <div className="overflow-y-auto overflow-x-hidden space-y-4 pr-1 scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-transparent">
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
                  className="w-full bg-black/50 border border-green-500/50 rounded-lg px-3 py-2 text-green-300 focus:outline-none focus:border-green-400 disabled:opacity-50"
                >
                  <option value="">-- SELECT ELECTION --</option>
                  {elections.map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase text-green-600 mb-2">Repetitions</label>
                  <input
                    type="number" min="1" max="100"
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={isRunning}
                    className="w-full bg-black/50 border border-green-500/50 rounded-lg px-3 py-2 text-green-300 focus:outline-none focus:border-green-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-green-600 mb-2">Wait Time (sec)</label>
                  <select
                    value={waitTime}
                    onChange={(e) => setWaitTime(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full bg-black/50 border border-green-500/50 rounded-lg px-3 py-2 text-green-300 focus:outline-none focus:border-green-400 disabled:opacity-50"
                  >
                    <option value="30">30 Seconds</option>
                    <option value="60">1 Minute</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase text-green-600 mb-2">Number of Batches</label>
                <input
                  type="number" min="1" max="20"
                  value={batchCount}
                  onChange={(e) => handleBatchCountChange(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-black/50 border border-green-500/50 rounded-lg px-3 py-2 text-green-300 focus:outline-none focus:border-green-400 disabled:opacity-50"
                />
              </div>

              <div className="p-3 bg-black/30 border border-green-500/20 rounded-lg space-y-2">
                <label className="block text-xs uppercase text-green-600 mb-2">Votes per Batch</label>
                <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-green-900 pr-1">
                  {batchVotes.map((votes, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">#{idx + 1}</span>
                      <input
                        type="number" min="1" step="100"
                        value={votes}
                        onChange={(e) => handleBatchVoteChange(idx, e.target.value)}
                        disabled={isRunning}
                        className="w-full bg-black/50 border border-green-500/50 rounded px-2 py-1 text-sm text-green-300 focus:outline-none focus:border-green-400 disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              {!isRunning ? (
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={startBatchSimulation}
                  disabled={!selectedElection}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 text-black font-bold py-4 rounded-lg hover:from-green-500 hover:to-green-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/50"
                >
                  <Play className="w-5 h-5" />
                  START BATCH SIMULATION
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={stopSimulation}
                  className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white font-bold py-4 rounded-lg hover:from-red-500 hover:to-red-400 transition-all flex items-center justify-center gap-2 animate-pulse shadow-lg shadow-red-500/50"
                >
                  <StopCircle className="w-5 h-5" />
                  STOP BATCH
                </motion.button>
              )}
              
              <button
                onClick={resetSimulation}
                disabled={isRunning}
                className="w-full bg-gray-800 border border-gray-700 text-green-400 font-semibold py-3 rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
          </motion.div>
        </div>
        
        {/* MIDDLE COLUMN: Progress & Stats */}
        <div className="overflow-y-auto overflow-x-hidden space-y-4 pr-1 scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-transparent">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-green-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm"
          >
            <div className="flex flex-col gap-1 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase text-green-400 flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  {currentPhase === 'waiting'    ? 'Waiting for next run...'
                   : currentPhase === 'queuing'    ? 'Queuing Votes...'
                   : currentPhase === 'confirming' ? 'Waiting for Confirmations...'
                   : currentPhase === 'complete'   ? 'Complete'
                   : 'Ready'}
                </h3>
                <span className="text-2xl font-bold text-green-400">{progress}%</span>
              </div>
              {(isRunning || currentPhase === 'complete') && currentRep > 0 && (
                <div className="text-xs text-gray-400">
                  Repetition: {currentRep}/{repeatCount} | Batch: {currentBatchIdx}/{batchCount}
                </div>
              )}
            </div>
            
            <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`absolute inset-y-0 left-0 bg-gradient-to-r ${currentPhase === 'waiting' ? 'from-yellow-600 via-yellow-500 to-orange-500' : 'from-green-600 via-green-500 to-cyan-500'} shadow-lg`}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference z-10">
                {currentPhase === 'waiting' ? `WAITING ${waitTime}s` : progress < 100 ? `${progress}% PROCESSING` : 'COMPLETE'}
              </div>
            </div>
          </motion.div>

          {/* Current Live Stats */}
          {(isRunning || finalMetrics) && currentPhase !== 'waiting' && (
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
          
          {/* Latest Metric Summary */}
          {finalMetrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border border-cyan-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-sm font-bold uppercase text-cyan-400">Latest Run Metrics</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <MetricRow label="Throughput" value={`${finalMetrics.throughput} v/s`}
                  icon={<Gauge className="w-4 h-4" />} />
                <MetricRow label="Success Rate" value={`${finalMetrics.successRate}%`}
                  icon={<CheckCircle className="w-4 h-4" />} />
                <MetricRow label="Avg Confirm Time" value={`${finalMetrics.avgConfirmation}ms`}
                  icon={<Timer className="w-4 h-4" />} />
                <MetricRow label="Total Time" value={`${(finalMetrics.totalTime / 1000).toFixed(2)}s`}
                  icon={<Clock className="w-4 h-4" />} />
              </div>
            </motion.div>
          )}

          {/* Previous Results Summary table (compact) */}
          {allResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-purple-500/30 rounded-xl p-4 bg-gray-900/50 backdrop-blur-sm"
            >
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                   <BarChart3 className="w-4 h-4 text-purple-500" />
                   <h3 className="text-xs font-bold uppercase text-purple-400">Completed Runs</h3>
                 </div>
                 {currentPhase === 'complete' && (
                   <button onClick={downloadCSV} className="flex items-center gap-1 text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30 hover:bg-purple-600/40 transition-colors">
                     <Download className="w-3 h-3" />
                     Download CSV
                   </button>
                 )}
               </div>
              <div className="max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900 pr-1">
                <table className="w-full text-xs text-center border-collapse">
                  <thead className="text-gray-400 bg-gray-800/80 sticky top-0">
                    <tr>
                      <th className="py-2 px-2 border border-gray-700">Batch Votes</th>
                      {Array.from({length: repeatCount}).map((_, i) => (
                        <th key={i} className="py-2 px-2 border border-gray-700">Rep {i + 1} (TPS)</th>
                      ))}
                      <th className="py-2 px-2 border border-gray-700">Avg TPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({length: batchCount}).map((_, b) => {
                      const bIdx = b + 1;
                      const batchResults = allResults.filter(r => r.batchIndex === bIdx);
                      if (batchResults.length === 0) return null;
                      const voteCount = batchResults[0].voteCount;
                      let sumTPS = 0;
                      return (
                        <tr key={bIdx} className="border-b border-gray-800 hover:bg-gray-800/30 text-gray-300 transition-colors">
                          <td className="py-2 px-2 border border-gray-800">{voteCount}</td>
                          {Array.from({length: repeatCount}).map((_, r) => {
                            const rIdx = r + 1;
                            const res = batchResults.find(res => res.rep === rIdx);
                            const tps = res ? res.metrics.throughput : '-';
                            if (res) sumTPS += Number(tps);
                            return <td key={rIdx} className="py-2 px-2 border border-gray-800 text-cyan-400">{tps}</td>;
                          })}
                          <td className="py-2 px-2 border border-gray-800 font-bold text-green-400">
                            {(sumTPS / batchResults.length).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        </div>
        
        {/* RIGHT COLUMN: Terminal Log */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-green-500/30 rounded-xl bg-black/80 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,0,0.1)] flex flex-col min-h-0"
        >
          <div className="flex-shrink-0 flex items-center justify-between border-b border-green-500/20 px-4 py-3">
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
          
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 font-mono text-xs space-y-1 scrollbar-thin scrollbar-thumb-green-900/60 scrollbar-track-black/40 leading-relaxed">
            <AnimatePresence initial={false}>
              {logs.map((log, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`border-l-2 pl-2 py-0.5 break-all ${
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
            <div ref={logsEndRef} />
            {logs.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-700">
                <div className="text-center">
                  <Terminal className="w-12 h-12 mx-auto mb-2 opacity-30 animate-pulse" />
                  <p className="text-sm uppercase tracking-wider">Awaiting Input...</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    green:  'border-green-500/30 bg-green-900/10 text-green-400',
    cyan:   'border-cyan-500/30 bg-cyan-900/10 text-cyan-400',
    red:    'border-red-500/30 bg-red-900/10 text-red-400',
    yellow: 'border-yellow-500/30 bg-yellow-900/10 text-yellow-400',
  };
  return (
    <div className={`border rounded-lg p-3 transition-all ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1 opacity-70">
        {icon}
        <span className="text-xs uppercase font-semibold">{label}</span>
      </div>
      <div className="text-xl font-bold">{Number(value).toLocaleString()}</div>
    </div>
  );
}

function MetricRow({ label, value, icon }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-800/50 last:border-0">
      <div className="flex items-center gap-2 text-xs text-gray-500 uppercase">{icon}{label}</div>
      <div className="text-sm font-bold text-cyan-400 ml-4">{value}</div>
    </div>
  );
}
