import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, User } from 'lucide-react';
import apiClient from '../api/client';

// Helper to get random color for candidates based on index
const getCandidateColor = (index) => {
  const colors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-indigo-500'];
  return colors[index % colors.length];
};

export default function VotingDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, election } = location.state || {};

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isVoting, setIsVoting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [error, setError] = useState('');

  // Redirect if no session data (e.g. direct URL access)
  useEffect(() => {
    if (!user || !election) {
      navigate('/');
    }
  }, [user, election, navigate]);

  // --- 🚀 DYNAMIC CANDIDATES MAPPING ---
  // This handles the API format: candidates: ["KVT", "TTF", "DMK"]
  const candidates = election?.candidates
    ? (Array.isArray(election.candidates)
      ? election.candidates.map((c, index) => {
          // Handle both simple strings and objects
          const candidateId = typeof c === 'string' ? c : c.id;
          const candidateName = typeof c === 'string' ? c : c.name;
          const candidateParty = typeof c === 'string' ? 'Independent' : (c.party || 'Independent');

          return {
            id: candidateId,
            name: candidateName,
            party: candidateParty,
            color: getCandidateColor(index),
            // Generate consistent avatar based on ID
            image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidateId}`
          };
        })
      : [])
    : [];
  // -------------------------------------

  const handleVote = async () => {
    if (!selectedCandidate) return;

    setIsVoting(true);
    setError('');

    try {
      // 1. Construct Vote Payload
      const payload = {
        electionId: election?.id,
        candidateId: selectedCandidate,
        voterProof: user.voterProof,
        hashedAadhaar: user.hashedAadhaar,
        hashedVoterID: user.hashedVoterID,
        hashedName: user.hashedName,
        location: 'Chennai, India' // Ideally use navigator.geolocation
      };

      console.log('🗳️ Casting Vote:', payload);

      // 2. Send to Backend
      const res = await apiClient.post('/votes', payload);

      if (res.data.success) {
        setVoteSuccess(true);
        // Optional: Navigate back after delay
        setTimeout(() => navigate('/'), 3000);
      } else {
        setError(res.data.error || 'Vote submission failed');
      }
    } catch (err) {
      console.error('Vote failed:', err);
      setError(err.response?.data?.error || 'Network error occurred');
    } finally {
      setIsVoting(false);
    }
  };

  if (!user || !election) return null; // Prevent flash before redirect

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-5xl mx-auto mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{election.title}</h1>
            <p className="text-sm text-gray-500">Select your preferred candidate</p>
          </div>
        </div>

        {/* User Profile Badge */}
        <div className="bg-white px-4 py-2 rounded-full shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-orange-600" />
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold text-gray-800">{user.name}</p>
            <p className="text-xs text-green-600 font-medium flex items-center gap-1 justify-end">
              <CheckCircle className="w-3 h-3" />
              Verified Voter
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto pb-10">
        {/* Candidates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {candidates.length > 0 ? (
            candidates.map((candidate) => (
              <motion.div
                key={candidate.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !voteSuccess && setSelectedCandidate(candidate.id)}
                className={`
                  relative bg-white rounded-2xl shadow-sm border-2 cursor-pointer transition-all overflow-hidden
                  ${selectedCandidate === candidate.id 
                    ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-xl' 
                    : 'border-transparent hover:border-gray-200 hover:shadow-md'}
                `}
              >
                {/* Selection Badge */}
                {selectedCandidate === candidate.id && (
                  <div className="absolute top-4 right-4 bg-orange-500 text-white p-1.5 rounded-full shadow-lg z-10">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                )}

                {/* Candidate Banner Color */}
                <div className={`h-24 ${candidate.color} opacity-90`} />

                {/* Content */}
                <div className="px-6 pb-6 text-center -mt-12">
                  <div className="w-24 h-24 mx-auto bg-white rounded-full p-1 shadow-md mb-4">
                    <img
                      src={candidate.image}
                      alt={candidate.name}
                      className="w-full h-full rounded-full bg-gray-50"
                    />
                  </div>

                  <h3 className="text-xl font-bold text-gray-800 mb-1">{candidate.name}</h3>
                  <p className="text-sm text-gray-500 font-medium">{candidate.party}</p>
                </div>
              </motion.div>
            ))
          ) : (
            // Fallback if no candidates found
            <div className="col-span-full text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No candidates found for this election.</p>
            </div>
          )}
        </div>

        {/* Bottom Section – behaves like footer, not floating */}
        {selectedCandidate && !voteSuccess && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <span className="block md:inline font-medium text-gray-500">You selected:</span>{' '}
              <span className="font-bold text-gray-900">
                {candidates.find(c => c.id === selectedCandidate)?.name}
              </span>
            </div>

            <button
              onClick={handleVote}
              disabled={isVoting}
              className="w-full md:w-auto bg-gradient-to-r from-orange-500 to-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isVoting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Confirming on Blockchain...
                </>
              ) : (
                <>
                  Confirm Vote
                  <CheckCircle className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Success Modal */}
        <AnimatePresence>
          {voteSuccess && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Vote Confirmed!</h2>
                <p className="text-gray-600 mb-6">
                  Your vote has been securely recorded on the blockchain.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors"
                >
                  Return to Home
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50"
            >
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{error}</p>
              <button onClick={() => setError('')} className="ml-2 opacity-50 hover:opacity-100">
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
