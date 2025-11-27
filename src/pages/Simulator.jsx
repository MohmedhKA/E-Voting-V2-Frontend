import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Zap, Terminal, Play, StopCircle } from 'lucide-react';
import apiClient from '../api/client';
import { generateVoterProofs } from '../lib/crypto';

export default function Simulator() {
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [voteCount, setVoteCount] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ success: 0, failed: 0 });

  // used to support EMERGENCY STOP without React state race issues
  const stopRef = useRef(false);

  // Fetch active elections once
  useEffect(() => {
    apiClient
      .get('/elections/active')
      .then((res) => {
        if (res.data.success) {
          setElections(res.data.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load elections for simulator', err);
      });
  }, []);

  const addLog = (msg) =>
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 80));

  const handleStop = () => {
    stopRef.current = true;
    addLog('⏹️ Stop requested by user...');
  };

  const startSimulation = async () => {
    if (!selectedElection) {
      addLog('❌ Select an election first!');
      return;
    }

    // reset control flags & UI
    stopRef.current = false;
    setIsRunning(true);
    setProgress(0);
    setStats({ success: 0, failed: 0 });
    addLog(`🚀 STARTING SIMULATION: ${voteCount} votes targeting ${selectedElection}...`);

    // get candidates for this election
    const electionObj = elections.find((e) => e.id === selectedElection);
    const candidates = electionObj ? electionObj.candidates || [] : [];

    if (!candidates.length) {
      addLog('❌ No candidates found for this election!');
      setIsRunning(false);
      return;
    }

    const BATCH_SIZE = 10;
    let completed = 0;
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < voteCount; i += BATCH_SIZE) {
        if (stopRef.current) {
          addLog('🛑 Emergency stop acknowledged. Halting simulation.');
          break;
        }

        const currentBatchSize = Math.min(BATCH_SIZE, voteCount - i);
        const batchPromises = [];

        for (let j = 0; j < currentBatchSize; j++) {
          const voterIndex = i + j + 1;

          // synthetic identity
          const mockAadhaar = `9999${Math.floor(10000000 + Math.random() * 90000000)}`;
          const mockVoterId = `SIM${Date.now()}${voterIndex}`;
          const mockName = `Simulated Voter ${voterIndex}`;

          // candidate
          const randomCand = candidates[Math.floor(Math.random() * candidates.length)];
          const candidateId = typeof randomCand === 'string' ? randomCand : randomCand.id;

          batchPromises.push(
            (async () => {
              try {
                const proofs = await generateVoterProofs(mockAadhaar, mockVoterId, mockName);
                const payload = {
                  electionId: selectedElection,
                  candidateId,
                  voterProof: proofs.voterProof,
                  hashedAadhaar: proofs.hashedAadhaar,
                  hashedVoterID: proofs.hashedVoterID,
                  hashedName: proofs.hashedName,
                  location: 'Chennai, India',
                };

                console.log('🗳️ Simulated vote payload:', payload);
                await apiClient.post('/votes', payload); // uses x-api-key from apiClient
                return true;
              } catch (err) {
                console.error('Simulated vote failed:', err.response?.data || err.message);
                return false;
              }
            })()
          );
        }

        const results = await Promise.all(batchPromises);
        const batchSuccess = results.filter(Boolean).length;
        const batchFail = results.length - batchSuccess;

        successCount += batchSuccess;
        failCount += batchFail;

        completed += currentBatchSize;
        setStats({ success: successCount, failed: failCount });
        setProgress(Math.round((completed / voteCount) * 100));

        // let UI & network breathe
        await new Promise((r) => setTimeout(r, 40));
      }
    } finally {
      addLog(`🏁 SIMULATION COMPLETE. Success: ${successCount}, Failed: ${failCount}`);
      setIsRunning(false);
      stopRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 flex flex-col md:flex-row gap-8">
      {/* LEFT: Controls */}
      <div className="w-full md:w-1/3 space-y-6">
        <div className="border border-green-500/30 p-6 rounded-xl bg-green-900/10 shadow-[0_0_15px_rgba(0,255,0,0.15)]">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-6 h-6 animate-pulse" />
            <h2 className="text-xl font-bold uppercase tracking-widest">Load Tester</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase opacity-70 mb-1">Target Election</label>
              <select
                value={selectedElection}
                onChange={(e) => setSelectedElection(e.target.value)}
                className="w-full bg-black border border-green-500/50 rounded p-2 text-green-400 focus:outline-none focus:border-green-300"
              >
                <option value="">-- SELECT TARGET --</option>
                {elections.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase opacity-70 mb-1">Vote Volume</label>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={voteCount}
                onChange={(e) => setVoteCount(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="text-right text-xl font-bold">{voteCount} VOTES</div>
            </div>

            {!isRunning ? (
              <button
                onClick={startSimulation}
                className="w-full bg-green-600 text-black font-bold py-4 rounded hover:bg-green-500 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                INITIATE FLOOD
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="w-full bg-red-600 text-white font-bold py-4 rounded hover:bg-red-500 transition-all flex items-center justify-center gap-2 animate-pulse"
              >
                <StopCircle className="w-5 h-5" />
                EMERGENCY STOP
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-green-500/30 p-4 rounded bg-green-900/5 text-center">
            <div className="text-2xl font-bold">{stats.success}</div>
            <div className="text-xs opacity-60 uppercase">Votes Queued</div>
          </div>
          <div className="border border-red-500/30 p-4 rounded bg-red-900/5 text-center text-red-400">
            <div className="text-2xl font-bold">{stats.failed}</div>
            <div className="text-xs opacity-60 uppercase">Failures</div>
          </div>
        </div>
      </div>

      {/* RIGHT: Progress + Logs */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Progress Bar */}
        <div className="border border-green-500/30 p-1 rounded h-12 relative overflow-hidden">
          <div
            className="h-full bg-green-600/20 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center font-bold z-10">
            {progress}% COMPLETE
          </div>
          <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/U3qYN8S0j3bpK/giphy.gif')] opacity-5 mix-blend-screen pointer-events-none" />
        </div>

        {/* Terminal */}
        <div className="flex-1 border border-green-500/30 rounded-xl bg-black p-4 flex flex-col shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-2 border-b border-green-500/20 pb-2 mb-2 opacity-50 text-xs">
            <Terminal className="w-4 h-4" />
            <span>SYSTEM_OUTPUT_STREAM</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-green-900">
            {logs.map((log, i) => (
              <div key={i} className="border-l-2 border-green-500/20 pl-2 text-xs">
                {log}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center mt-20 opacity-30">WAITING FOR COMMAND...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
