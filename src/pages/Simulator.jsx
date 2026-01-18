/**
 * @fileoverview Enhanced Performance Simulator (innovative-v3)
 * @description Complete performance testing with realistic crypto overhead
 * 
 * Features:
 * - Realistic mode: Tests with REAL Dilithium signatures
 * - Fast mode: Tests queue/blockchain only (no crypto)
 * - Real-time metrics tracking
 * - Live progress monitoring
 * - Blockchain confirmation tracking
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Terminal, Play, StopCircle, TrendingUp, Clock, 
  Database, CheckCircle, XCircle, Activity, Cpu, Timer,
  BarChart3, Shield, Gauge
} from 'lucide-react';
import apiClient from '../api/client';
import testingClient from '../api/testingClient';

export default function Simulator() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  
  // Election selection
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState('');
  
  // Test configuration
  const [voteCount, setVoteCount] = useState(100);
  const [batchSize, setBatchSize] = useState(50);
  const [testMode, setTestMode] = useState('realistic'); // 'realistic', 'fast', or 'production'
  
  // Test state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Metrics
  const [stats, setStats] = useState({
    queued: 0,
    failed: 0,
    confirmed: 0,
    pending: 0,
    tps: 0,
    avgConfirmationTime: 0,
    signatureTime: 0,
    signaturesPerSec: 0,
    auditTime: 0,
    avgAuditTime: 0 
  });
  
  // Real-time data
  const [logs, setLogs] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState(null);
  
  // Control refs
  const stopRef = useRef(false);
  const startTimeRef = useRef(0);
  const metricsIntervalRef = useRef(null);
  
  // ==========================================
  // INITIALIZATION
  // ==========================================
  
  useEffect(() => {
    // Fetch active elections on mount
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
    
    // Cleanup on unmount
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, []);
  
  // ==========================================
  // LOGGING FUNCTIONS
  // ==========================================
  
  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = {
      error: '❌',
      success: '✅',
      warning: '⚠️',
      info: 'ℹ️'
    }[type] || 'ℹ️';
    
    setLogs(prev => [
      { msg: `[${timestamp}] ${emoji} ${msg}`, type },
      ...prev
    ].slice(0, 100)); // Keep last 100 logs
  };
  
  const clearLogs = () => {
    setLogs([]);
  };
  
  // ==========================================
  // METRICS POLLING
  // ==========================================
  
  const startMetricsPolling = () => {
    if (!selectedElection) return;
    
    // Poll metrics every 2 seconds
    metricsIntervalRef.current = setInterval(async () => {
      try {
        const response = await testingClient.get(`/metrics/${selectedElection}`);
        
        if (response.data.success) {
          const metrics = response.data.data;
          setLiveMetrics(metrics);
          
          // Update stats with live metrics
          setStats(prev => ({
            ...prev,
            confirmed: metrics.votesConfirmed,
            pending: metrics.currentQueueDepth,
            failed: metrics.votesFailed,
            avgConfirmationTime: metrics.avgConfirmationTime
          }));
        }
      } catch (error) {
        // Silently fail to avoid log spam
        console.error('Metrics poll error:', error);
      }
    }, 2000);
  };
  
  const stopMetricsPolling = () => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }
  };
  
  // ==========================================
  // SIMULATION CONTROL
  // ==========================================
  
  const startSimulation = async () => {
    // Validation
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
    setStats({
      queued: 0,
      failed: 0,
      confirmed: 0,
      pending: 0,
      tps: 0,
      avgConfirmationTime: 0,
      signatureTime: 0,
      signaturesPerSec: 0,
      auditTime: 0, 
      avgAuditTime: 0        
    });
    clearLogs();
    startTimeRef.current = Date.now();
    
    // Start metrics polling
    startMetricsPolling();
    
    // Log test configuration
    addLog('═══════════════════════════════════════', 'info');
    addLog('🚀 PERFORMANCE TEST STARTED', 'success');
    addLog('═══════════════════════════════════════', 'info');
    addLog(`📊 Configuration:`, 'info');
    addLog(`   • Election: ${electionObj.title}`, 'info');
    addLog(`   • Total votes: ${voteCount}`, 'info');
    addLog(`   • Batch size: ${batchSize}`, 'info');
    addLog(`   • Test mode: ${testMode === 'realistic' ? 'REALISTIC (with crypto)' : 'FAST (no crypto)'}`, 'info');
    addLog(`   • Candidates: ${candidates.length}`, 'info');
    addLog('═══════════════════════════════════════', 'info');
    addLog('', 'info');
    
    try {
      // Generate test votes
      addLog(`🔧 Generating ${voteCount} test votes...`, 'info');
      const allVotes = [];
      
      for (let i = 0; i < voteCount; i++) {
        const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
        const candidateId = typeof randomCandidate === 'string' ? randomCandidate : randomCandidate.id;
        
        allVotes.push({
          electionId: selectedElection,
          candidateId,
          batchID: `BATCH_${Math.floor(i / 100)}`
        });
      }
      
      addLog(`✅ Generated ${allVotes.length} test votes`, 'success');
      addLog('', 'info');
      
      // Select endpoint based on test mode
      const endpoint = testMode === 'production'
        ? '/bulk-vote-production'
        : testMode === 'realistic' 
        ? '/bulk-vote-with-signatures'
        : '/bulk-vote';

      if (testMode === 'production') {
        addLog('🏭 Using PRODUCTION mode - FULL flow with PDC audit writes...', 'info');
        addLog('⚠️  WARNING: This will be SLOW due to blockchain writes!', 'warning');
      } else if (testMode === 'realistic') {
        addLog('🔐 Using REALISTIC mode - generating Dilithium signatures...', 'info');
      } else {
        addLog('⚡ Using FAST mode - skipping cryptography...', 'info');
      }
      
      // Process in batches
      const totalBatches = Math.ceil(allVotes.length / batchSize);
      let processedVotes = 0;
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Check for stop signal
        if (stopRef.current) {
          addLog('🛑 Simulation stopped by user', 'warning');
          break;
        }
        
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, allVotes.length);
        const batch = allVotes.slice(batchStart, batchEnd);
        
        addLog(`📤 Batch ${batchIndex + 1}/${totalBatches}: Sending ${batch.length} votes...`, 'info');
        
        try {
          const response = await testingClient.post(endpoint, {
            votes: batch,
            electionId: selectedElection
          });
          
          if (response.data.success) {
            const result = response.data.data;
            
            processedVotes += result.queued;
            
            setStats(prev => ({
              ...prev,
              queued: prev.queued + result.queued,
              failed: prev.failed + result.failed,
              tps: result.throughput,
              signatureTime: result.signatureTime || 0,
              signaturesPerSec: result.signaturesPerSec || 0,
              auditTime: result.auditTime || 0,  
              avgAuditTime: result.avgAuditTime || 0 
            }));
            
            // Log batch result
            const batchLog = `✅ Batch ${batchIndex + 1}: ${result.queued} queued, ${result.failed} failed`;
            const performanceLog = testMode === 'production'
              ? ` | 🏭 PDC: ${result.avgAuditTime}ms avg`
              : testMode === 'realistic'
              ? ` | 🔐 ${result.signaturesPerSec || 0} sigs/sec`
              : ` | ⚡ ${result.throughput} votes/sec`;

            addLog(batchLog + performanceLog, result.failed > 0 ? 'warning' : 'success');

            
          } else {
            addLog(`❌ Batch ${batchIndex + 1} returned error`, 'error');
          }
          
        } catch (error) {
          addLog(`❌ Batch ${batchIndex + 1} failed: ${error.message}`, 'error');
          
          setStats(prev => ({
            ...prev,
            failed: prev.failed + batch.length
          }));
        }
        
        // Update progress
        setProgress(Math.round((processedVotes / voteCount) * 100));
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Calculate final metrics
      const totalTime = Date.now() - startTimeRef.current;
      const overallTPS = processedVotes > 0
        ? (processedVotes / (totalTime / 1000)).toFixed(2)
        : 0;
      
      // Log completion
      addLog('', 'info');
      addLog('═══════════════════════════════════════', 'info');
      addLog('🏁 SIMULATION COMPLETE!', 'success');
      addLog('═══════════════════════════════════════', 'info');
      addLog(`📊 Results:`, 'info');
      addLog(`   • Total votes: ${processedVotes}`, 'info');
      addLog(`   • Successfully queued: ${stats.queued}`, 'success');
      addLog(`   • Failed: ${stats.failed}`, stats.failed > 0 ? 'error' : 'info');
      addLog(`   • Overall throughput: ${overallTPS} votes/sec`, 'success');
      addLog(`   • Total time: ${(totalTime / 1000).toFixed(2)}s`, 'info');
      
      if (testMode === 'production' && stats.auditTime > 0) {
        addLog(`   • Signature + PDC time: ${(stats.signatureTime / 1000).toFixed(2)}s`, 'info');
        addLog(`   • Total PDC writes: ${(stats.auditTime / 1000).toFixed(2)}s`, 'info');
        addLog(`   • Avg PDC write: ${stats.avgAuditTime}ms per vote`, 'info');
      } else if (testMode === 'realistic' && stats.signatureTime > 0) {
        addLog(`   • Signature time: ${(stats.signatureTime / 1000).toFixed(2)}s`, 'info');
        addLog(`   • Signature rate: ${stats.signaturesPerSec} sigs/sec`, 'info');
      }
      
      addLog('═══════════════════════════════════════', 'info');
      addLog('', 'info');
      addLog('⏳ Monitoring blockchain confirmations...', 'info');
      addLog('   (Keep this page open to see live confirmations)', 'info');
      
    } catch (error) {
      addLog(`❌ Simulation error: ${error.message}`, 'error');
      console.error('Simulation error:', error);
    } finally {
      setIsRunning(false);
      setProgress(100);
      
      // Keep polling metrics for confirmations
      setTimeout(() => {
        stopMetricsPolling();
        addLog('📊 Stopped metrics polling', 'info');
      }, 60000); // Stop after 1 minute
    }
  };
  
  const stopSimulation = () => {
    stopRef.current = true;
    addLog('⏹️ Stop signal sent...', 'warning');
  };
  
  const resetMetrics = async () => {
    try {
      await testingClient.post('/reset-metrics');
      
      setStats({
        queued: 0,
        failed: 0,
        confirmed: 0,
        pending: 0,
        tps: 0,
        avgConfirmationTime: 0,
        signatureTime: 0,
        signaturesPerSec: 0,
        auditTime: 0,
        avgAuditTime: 0
      });
      
      setLiveMetrics(null);
      setProgress(0);
      
      addLog('🔄 Metrics reset successfully', 'success');
    } catch (error) {
      addLog(`❌ Failed to reset metrics: ${error.message}`, 'error');
    }
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
            Performance Simulator
          </h1>
        </div>
        <p className="text-green-600 text-sm">
          Backend + Blockchain Load Testing • Realistic Crypto Overhead • Real-time Metrics
        </p>
      </motion.div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ==========================================
            LEFT COLUMN: CONTROLS
            ========================================== */}
        <div className="space-y-6">
          {/* Configuration Panel */}
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
              {/* Election Selection */}
              <div>
                <label className="block text-xs uppercase text-green-600 mb-2">
                  Target Election
                </label>
                <select
                  value={selectedElection}
                  onChange={(e) => setSelectedElection(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-black/50 border border-green-500/50 rounded-lg px-3 py-2 text-green-300 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">-- SELECT ELECTION --</option>
                  {elections.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Test Mode Selection */}
              <div>
                <label className="block text-xs uppercase text-green-600 mb-2">
                  Testing Mode
                </label>
                <select
                  value={testMode}
                  onChange={(e) => setTestMode(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-black/50 border border-green-500/50 rounded-lg px-3 py-2 text-green-300 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 disabled:opacity-50"
                >
                  <option value="realistic">🔐 Realistic (With Crypto)</option>
                  <option value="production">🏭 Production (Full Flow + PDC)</option>
                  <option value="fast">⚡ Fast (Skip Crypto)</option>
                </select>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  {testMode === 'realistic' 
                    ? '✅ Tests with REAL Dilithium-3 signatures (no PDC audit)'
                    : testMode === 'production'
                    ? '🏭 FULL production flow with PDC audit writes (slowest, most realistic)'
                    : '⚡ Tests queue/blockchain only (max throughput)'
                  }
                </p>
              </div>
              
              {/* Vote Count Slider */}
              <div>
                <label className="block text-xs uppercase text-green-600 mb-2">
                  Vote Count: <span className="text-green-400 font-bold text-lg">{voteCount}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="3000"
                  step="10"
                  value={voteCount}
                  onChange={(e) => setVoteCount(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>10</span>
                  <span>1500</span>
                  <span>3000</span>
                </div>
              </div>
              
              {/* Batch Size Slider */}
              <div>
                <label className="block text-xs uppercase text-green-600 mb-2">
                  Batch Size: <span className="text-cyan-400 font-bold text-lg">{batchSize}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>10</span>
                  <span>100</span>
                  <span>200</span>
                </div>
              </div>
            </div>
            
            {/* Control Buttons */}
            <div className="mt-6 space-y-3">
              {!isRunning ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startSimulation}
                  disabled={!selectedElection}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 text-black font-bold py-4 rounded-lg hover:from-green-500 hover:to-green-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/50"
                >
                  <Play className="w-5 h-5" />
                  START SIMULATION
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stopSimulation}
                  className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white font-bold py-4 rounded-lg hover:from-red-500 hover:to-red-400 transition-all flex items-center justify-center gap-2 animate-pulse shadow-lg shadow-red-500/50"
                >
                  <StopCircle className="w-5 h-5" />
                  EMERGENCY STOP
                </motion.button>
              )}
              
              <button
                onClick={resetMetrics}
                disabled={isRunning}
                className="w-full bg-gray-800 border border-gray-700 text-green-400 font-semibold py-3 rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Reset Metrics
              </button>
            </div>
          </motion.div>
          
          {/* Quick Stats Grid */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-3"
          >
            <StatCard
              icon={<Database className="w-5 h-5" />}
              label="Queued"
              value={stats.queued}
              color="green"
            />
            <StatCard
              icon={<CheckCircle className="w-5 h-5" />}
              label="Confirmed"
              value={stats.confirmed}
              color="cyan"
            />
            <StatCard
              icon={<XCircle className="w-5 h-5" />}
              label="Failed"
              value={stats.failed}
              color="red"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="Pending"
              value={stats.pending}
              color="yellow"
            />
          </motion.div>
        </div>
        
        {/* ==========================================
            MIDDLE COLUMN: PROGRESS & METRICS
            ========================================== */}
        <div className="space-y-6">
          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-green-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase text-green-400 flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                Progress
              </h3>
              <span className="text-2xl font-bold text-green-400">{progress}%</span>
            </div>
            
            <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 via-green-500 to-cyan-500 shadow-lg"
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference z-10">
                {progress < 100 ? `${progress}% PROCESSING` : '✓ COMPLETE'}
              </div>
            </div>
          </motion.div>
          
          {/* Live Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border border-cyan-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-cyan-500" />
              <h3 className="text-sm font-bold uppercase text-cyan-400">Live Metrics</h3>
              {liveMetrics && (
                <span className="ml-auto text-xs text-gray-500">
                  {new Date(liveMetrics.lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </div>
            
            {liveMetrics || stats.queued > 0 ? (
              <div className="space-y-3">
                <MetricRow 
                  label="Throughput" 
                  value={`${stats.tps || 0} votes/sec`}
                  sublabel={testMode === 'realistic' ? 'Including crypto overhead' : 'Queue ingestion rate'}
                  icon={<Gauge className="w-4 h-4" />}
                />
                
                {testMode === 'production' && stats.avgAuditTime > 0 && (
                  <MetricRow 
                    label="PDC Audit Time" 
                    value={`${stats.avgAuditTime}ms avg`}
                    sublabel={`Total PDC writes: ${(stats.auditTime / 1000).toFixed(2)}s`}
                    icon={<Shield className="w-4 h-4" />}
                  />
                )}

                {testMode === 'realistic' && stats.signaturesPerSec > 0 && (
                  <MetricRow 
                    label="Signature Rate" 
                    value={`${stats.signaturesPerSec} sigs/sec`}
                    sublabel="Dilithium-3 signing performance"
                    icon={<Shield className="w-4 h-4" />}
                  />
                )}
                                
                {liveMetrics && (
                  <>
                    <MetricRow 
                      label="Queue → Blockchain" 
                      value={liveMetrics.avgConfirmationTime > 0 
                        ? `${(liveMetrics.avgConfirmationTime / 1000).toFixed(2)}s avg`
                        : 'Pending...'
                      }
                      sublabel={liveMetrics.minConfirmationTime 
                        ? `${(liveMetrics.minConfirmationTime / 1000).toFixed(2)}s min • ${(liveMetrics.maxConfirmationTime / 1000).toFixed(2)}s max`
                        : 'Waiting for confirmations...'
                      }
                      icon={<Timer className="w-4 h-4" />}
                    />
                    
                    <MetricRow 
                      label="Success Rate" 
                      value={`${liveMetrics.successRate || 0}%`}
                      sublabel={`${liveMetrics.votesConfirmed} of ${liveMetrics.votesQueued} confirmed`}
                      icon={<CheckCircle className="w-4 h-4" />}
                    />
                    
                    <MetricRow 
                      label="Queue Depth" 
                      value={liveMetrics.currentQueueDepth || 0}
                      sublabel="Votes waiting for blockchain"
                      icon={<Database className="w-4 h-4" />}
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Start simulation to see live metrics</p>
              </div>
            )}
          </motion.div>
          
          {/* Performance Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="border border-purple-500/30 rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <h3 className="text-sm font-bold uppercase text-purple-400">Performance Summary</h3>
            </div>
            
            {stats.queued > 0 ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-gray-800">
                  <span className="text-gray-500">Total Processed:</span>
                  <span className="text-green-400 font-bold">{stats.queued + stats.failed}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-800">
                  <span className="text-gray-500">Success Rate:</span>
                  <span className="text-cyan-400 font-bold">
                    {((stats.queued / (stats.queued + stats.failed)) * 100).toFixed(1)}%
                  </span>
                </div>
                {testMode === 'production' && stats.auditTime > 0 && (
                  <>
                    <div className="flex justify-between items-center py-1 border-b border-gray-800">
                      <span className="text-gray-500">PDC Audit Time:</span>
                      <span className="text-purple-400 font-bold">
                        {(stats.auditTime / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-800">
                      <span className="text-gray-500">Avg PDC Write:</span>
                      <span className="text-purple-400 font-bold">
                        {stats.avgAuditTime}ms
                      </span>
                    </div>
                  </>
                )}

                {testMode === 'realistic' && stats.signatureTime > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-gray-800">
                    <span className="text-gray-500">Signature Time:</span>
                    <span className="text-purple-400 font-bold">
                      {(stats.signatureTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-gray-800">
                  <span className="text-gray-500">Avg Confirmation:</span>
                  <span className="text-purple-400 font-bold">
                    {stats.avgConfirmationTime > 0 
                      ? `${(stats.avgConfirmationTime / 1000).toFixed(2)}s`
                      : 'Pending...'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Total Time:</span>
                  <span className="text-yellow-400 font-bold">
                    {((Date.now() - startTimeRef.current) / 1000).toFixed(2)}s
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <Cpu className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Performance data will appear here</p>
              </div>
            )}
          </motion.div>
        </div>
        
        {/* ==========================================
            RIGHT COLUMN: TERMINAL LOGS
            ========================================== */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-green-500/30 rounded-xl bg-black/80 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,0,0.1)] flex flex-col"
        >
          {/* Terminal Header */}
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
          
          {/* Terminal Content */}
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
                    log.type === 'error' 
                      ? 'border-red-500/50 text-red-400' 
                      : log.type === 'success'
                      ? 'border-green-500/50 text-green-400'
                      : log.type === 'warning'
                      ? 'border-yellow-500/50 text-yellow-400'
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
// HELPER COMPONENTS
// ==========================================

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    green: 'border-green-500/30 bg-green-900/10 text-green-400',
    cyan: 'border-cyan-500/30 bg-cyan-900/10 text-cyan-400',
    red: 'border-red-500/30 bg-red-900/10 text-red-400',
    yellow: 'border-yellow-500/30 bg-yellow-900/10 text-yellow-400',
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`border rounded-lg p-4 transition-all ${colorClasses[color]}`}
    >
      <div className="flex items-center gap-2 mb-1 opacity-70">
        {icon}
        <span className="text-xs uppercase font-semibold">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </motion.div>
  );
}

function MetricRow({ label, value, sublabel, icon }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-800/50 last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-500 uppercase mb-1">
          {icon}
          {label}
        </div>
        {sublabel && (
          <div className="text-xs text-gray-700 mt-0.5">{sublabel}</div>
        )}
      </div>
      <div className="text-lg font-bold text-cyan-400 ml-4">{value}</div>
    </div>
  );
}
