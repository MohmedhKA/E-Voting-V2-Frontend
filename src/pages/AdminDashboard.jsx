import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, PlayCircle, BarChart2, Trash2, ShieldCheck, Terminal, Settings, Activity, LogOut } from 'lucide-react';
import adminClient from '../api/adminClient';
import ResultsModal from '../components/ResultsModal';

export default function AdminDashboard() {
  const [electionId, setElectionId] = useState('secure-election-2025');
  const [title, setTitle] = useState('Secure Admin Election');
  const [description, setDescription] = useState('Admin-created secure election');
  const [candidateInput, setCandidateInput] = useState('');
  const [candidates, setCandidates] = useState(['KVT', 'DMK']); // Updated defaults to match your theme
  const [log, setLog] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [resultsData, setResultsData] = useState(null);

  const appendLog = (msg) => setLog((prev) => `[${new Date().toLocaleTimeString()}] ${msg}\n` + prev);

  const handleAddCandidate = () => {
    const trimmed = candidateInput.trim();
    if (!trimmed) return;
    if (!candidates.includes(trimmed)) setCandidates([...candidates, trimmed]);
    setCandidateInput('');
  };

  const handleRemoveCandidate = (name) => {
    setCandidates(candidates.filter((c) => c !== name));
  };

  const handleCreateElection = async () => {
    try {
      setIsBusy(true);
      appendLog(`Creating election ${electionId}...`);
      const payload = { electionId, title, description, candidates };
      const res = await adminClient.post('/elections', payload);
      appendLog(`✅ Created: ${res.data.message || 'Election created.'}`);
    } catch (err) {
      console.error(err);
      appendLog(`❌ Create failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleActivateElection = async () => {
    try {
      setIsBusy(true);
      appendLog(`Activating election ${electionId}...`);
      const res = await adminClient.patch(`/elections/${electionId}/activate`);
      appendLog(`✅ Activated: ${res.data.message || 'Election is now ACTIVE.'}`);
    } catch (err) {
      console.error(err);
      appendLog(`❌ Activate failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleViewResults = async () => {
    try {
      setIsBusy(true);
      appendLog(`Fetching results for ${electionId}...`);
      const res = await adminClient.get(`/votes/${electionId}`);
      const data = res.data.data || {};
      setResultsData(data.results || {});
      appendLog(`✅ Results loaded.`);
      setShowResults(true);
    } catch (err) {
      console.error(err);
      appendLog(`❌ Fetch results failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="font-bold text-lg tracking-wide">AdminPanel</h1>
            <p className="text-xs text-slate-400">Secure Election Control</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <div className="px-4 py-3 bg-slate-800 rounded-xl text-orange-400 font-medium flex items-center gap-3">
            <Settings className="w-5 h-5" />
            Election Manager
          </div>
          <div className="px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-medium flex items-center gap-3 transition-colors cursor-pointer">
            <Activity className="w-5 h-5" />
            System Health
          </div>
        </nav>

        <div className="p-6 border-t border-slate-800">
           <button className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
             <LogOut className="w-4 h-4" />
             Sign Out
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Election Configuration</h2>
            <p className="text-gray-500 mt-1">Create, manage, and monitor blockchain elections</p>
          </div>
          <div className="flex items-center gap-2">
             <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
             <span className="text-sm font-medium text-gray-600">System Online</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Election Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Card: Election Details */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
                Election Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Election ID</label>
                  <input
                    type="text"
                    value={electionId}
                    onChange={(e) => setElectionId(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm text-gray-700"
                    placeholder="e.g. election-2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm text-gray-700"
                    placeholder="Election Title"
                  />
                </div>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm text-gray-700 min-h-[80px]"
                    placeholder="Brief description..."
                  />
              </div>
            </motion.div>

            {/* Card: Candidates */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                Manage Candidates
              </h3>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={candidateInput}
                  onChange={(e) => setCandidateInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCandidate()}
                  className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-black"
                  placeholder="Enter candidate name..."
                />
                <button
                  onClick={handleAddCandidate}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <AnimatePresence>
                  {candidates.map((c) => (
                    <motion.div
                      key={c}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="bg-white border border-gray-200 pl-4 pr-2 py-2 rounded-full flex items-center gap-3 shadow-sm"
                    >
                      <span className="font-medium text-gray-700">{c}</span>
                      <button
                        onClick={() => handleRemoveCandidate(c)}
                        className="w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {candidates.length === 0 && (
                  <p className="text-gray-400 text-sm italic">No candidates added yet.</p>
                )}
              </div>
            </motion.div>

            {/* Action Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleCreateElection}
                disabled={isBusy}
                className="bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-bold shadow-sm hover:shadow-md hover:border-orange-200 transition-all flex flex-col items-center gap-2"
              >
                <Plus className="w-6 h-6 text-orange-500" />
                Create Election
              </button>

              <button
                onClick={handleActivateElection}
                disabled={isBusy}
                className="bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-bold shadow-sm hover:shadow-md hover:border-green-200 transition-all flex flex-col items-center gap-2"
              >
                <PlayCircle className="w-6 h-6 text-green-500" />
                Start Voting
              </button>

              <button
                onClick={handleViewResults}
                disabled={isBusy}
                className="bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-bold shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col items-center gap-2"
              >
                <BarChart2 className="w-6 h-6 text-blue-500" />
                View Results
              </button>
            </div>

          </div>

          {/* Right Column: Logs */}
          <div className="lg:col-span-1">
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="bg-slate-900 rounded-2xl shadow-lg p-6 h-full min-h-[500px] flex flex-col"
             >
               <div className="flex items-center gap-2 mb-4 border-b border-slate-700 pb-4">
                 <Terminal className="w-5 h-5 text-green-400" />
                 <h3 className="text-white font-mono font-bold">System Logs</h3>
               </div>
               
               <div className="flex-1 bg-slate-950 rounded-xl p-4 overflow-y-auto font-mono text-xs md:text-sm text-slate-300 leading-relaxed border border-slate-800 shadow-inner max-h-[600px]">
                 {log ? (
                   <pre className="whitespace-pre-wrap">{log}</pre>
                 ) : (
                   <div className="text-slate-600 italic text-center mt-10">
                     Ready for operations...
                   </div>
                 )}
               </div>
               
               <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                 <span>Secure Connection: TLS 1.3</span>
                 <span>v2.0.1</span>
               </div>
             </motion.div>
          </div>

        </div>
      </div>

      {/* Results Modal Reused */}
      <ResultsModal
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        results={resultsData}
        isLoading={isBusy}
      />
    </div>
  );
}
