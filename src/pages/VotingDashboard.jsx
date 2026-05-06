/**
 * VotingDashboard.jsx - Secure Anonymous Voting Interface
 * 
 * Security Features:
 * 1. Blind Signature Request - EC signs without knowing voter identity
 * 2. Anonymous Vote ID - Random ID, not linked to voter
 * 3. No Identity in Vote - hashedAadhaar/voterProof NOT sent
 * 4. Verification Token - One-time candidate verification (2 min window)
 * 5. Receipt-Free - Permanent receipt shows NO candidate choice
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, AlertCircle, Loader2, ArrowLeft, User, 
  FileText, Loader, Shield, Key, Clock 
} from 'lucide-react';
import apiClient from '../api/client';
import VoteSuccessModal from '../components/VoteSuccessModal';
import { generateVoteID, generateNonce, generateBatchID } from '../lib/crypto';
import { blindBallot, unblind } from '../lib/rsaBlind';

// Helper to get random color for candidates based on index
const getCandidateColor = (index) => {
  const colors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-indigo-500'];
  return colors[index % colors.length];
};

function formatSessionTimer(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VotingDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get user, election, and SESSION data from navigation state
  const { user, election, sessionID, authToken, sessionExpiry } = location.state || {};

  // Candidate Selection State
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  
  // Voting Process State
  const [isVoting, setIsVoting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [error, setError] = useState('');

  // 🆕 NEW: Blind Signature State
  const [votingStatus, setVotingStatus] = useState('');

  // 🆕 NEW: Verification Token State (one-time candidate verification)
  const [verificationToken, setVerificationToken] = useState(null);
  const [verificationExpiry, setVerificationExpiry] = useState(null);

  // 🆕 NEW: Vote ID State (for receipt)
  const [voteID, setVoteID] = useState(null);

  // Receipt State
  const [receipt, setReceipt] = useState(null);
  const [isPollingReceipt, setIsPollingReceipt] = useState(false);

  // 🆕 NEW: Session Timer State
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(null);

  // ============================================
  // SECURITY CHECK: Redirect if no session data
  // ============================================
  useEffect(() => {
    if (!user || !election) {
      console.error('❌ No user/election data - redirecting to login');
      navigate('/');
      return;
    }

    if (!sessionID || !authToken) {
      console.error('❌ No session data - redirecting to login');
      alert('Session expired. Please login again.');
      navigate('/');
      return;
    }

    console.log('✅ Session validated:', {
      sessionID,
      hasToken: !!authToken,
      expiresAt: sessionExpiry ? new Date(sessionExpiry).toLocaleTimeString() : 'N/A'
    });
  }, [user, election, sessionID, authToken, sessionExpiry, navigate]);

  // ============================================
  // 🆕 NEW: Session Timer Countdown
  // ============================================
  useEffect(() => {
    if (!sessionExpiry) return;

    const expiry = new Date(sessionExpiry).getTime();

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setSessionTimeRemaining(remaining);
      if (remaining === 0) {
        alert('⚠️ Session expired! Please login again.');
        navigate('/');
      }
    };

    updateTimer(); // Set immediately on mount — no 1-second blank

    const timer = setInterval(updateTimer, 1000);

    // ✅ Snap correct the instant tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) updateTimer();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionExpiry, navigate]);


  // ============================================
  // Dynamic Candidates Mapping
  // ============================================
  const candidates = election?.candidates
    ? (Array.isArray(election.candidates)
      ? election.candidates.map((c, index) => {
          const candidateId = typeof c === 'string' ? c : c.id;
          const candidateName = typeof c === 'string' ? c : c.name;
          const candidateParty = typeof c === 'string' ? 'Independent' : (c.party || 'Independent');

          return {
            id: candidateId,
            name: candidateName,
            party: candidateParty,
            color: getCandidateColor(index),
            image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidateId}`
          };
        })
      : [])
    : [];

  // ============================================
  // 🆕 NEW: Poll for Receipt (Receipt-Free!)
  // ============================================
  const fetchReceipt = async (electionId, generatedVoteID) => {
    setIsPollingReceipt(true);
    let attempts = 0;
    const maxAttempts = 15; // 30 seconds max
    
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        // 🆕 CHANGED: Use voteID instead of aadhaarHash
        const res = await apiClient.get(`/votes/receipt/${electionId}/${generatedVoteID}`);
        
        if (res.data.success) {
          clearInterval(pollInterval);
          setReceipt(res.data.data);
          setIsPollingReceipt(false);
          console.log('✅ Receipt found (receipt-free):', res.data.data);
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error("Receipt fetch error", err);
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setIsPollingReceipt(false);
          setError('Receipt not available. Your vote was recorded but receipt generation timed out.');
        }
      }
    }, 2000);
  };

  // ============================================
  // 🆕 COMPLETELY REWRITTEN: Handle Vote with True Client-Side RSA Blind Signature
  // ============================================
  const handleVote = async () => {
    if (!selectedCandidate || isVoting) return;

    setIsVoting(true);
    setError('');

    try {
      console.log('🗳️ Starting secure voting process...');

      // ============================================
      // STEP 1: Generate cryptographic components
      // ============================================
      const generatedVoteID = generateVoteID();
      const nonce = generateNonce();
      const batchID = generateBatchID();
      
      console.log('🔐 Generated crypto components:', {
        voteID: generatedVoteID,
        nonce: nonce.substring(0, 16) + '...',
        batchID
      });

      const ballotPayload = {
        voteID: generatedVoteID,
        electionId: election.id,
        candidateId: selectedCandidate,
        nonce,
        batchID,
        timestamp: Date.now()
      };

      setVotingStatus('Preparing secure ballot...');

      // Get EC Public Key
      const pubKeyRes = await apiClient.get('/ec/public-key');
      const pubKeyData = pubKeyRes.data.data || pubKeyRes.data;
      const { n, e } = pubKeyData;

      if (!n || !e) throw new Error("Failed to retrieve EC public key");

      // ============================================
      // STEP 2: Create true mathematically blinded ballot
      // ============================================
      const { blindedMessageHex, r } = await blindBallot(ballotPayload, n, e);
      console.log('🎭 Ballot mathematically blinded');

      // ============================================
      // STEP 3: Request blind signature from EC
      // ============================================
      setVotingStatus('Requesting authorization...');
      console.log('📝 Requesting blind signature from EC...');

      const sigRes = await apiClient.post('/ec/request-blind-signature', {
        blindedMessage: blindedMessageHex,
        sessionID: sessionID, // sent for auth
        nonce: nonce
      });

      const signatureData = sigRes.data.data || sigRes.data;
      const receivedBlindedSignatureHex = 
          signatureData.blindedSignature?.trim() || signatureData.blindSignature?.trim();

      if (!receivedBlindedSignatureHex) {
          throw new Error('Backend error: Blind signature not returned');
      }
      console.log('✅ Received blinded signature from EC');

      // ============================================
      // STEP 4: Unblind the signature in browser (Discard r)
      // ============================================
      setVotingStatus('Finalizing...');
      const signatureHex = unblind(receivedBlindedSignatureHex, r, n);
      console.log('✅ Unblinded signature successfully');
      // r variable will be automatically garbage collected here

      // ============================================
      // STEP 5: Cast unblinded vote (ANONYMOUS!)
      // ============================================
      setVotingStatus('Submitting vote...');
      console.log('📮 Casting anonymous vote with valid unblinded signature...');

      const voteRes = await apiClient.post('/votes/submit', {
        voteID: generatedVoteID,
        electionId: election.id,
        candidateId: selectedCandidate,
        blindSignature: signatureHex,
        batchID: batchID
      });

      if (!voteRes.data.success) {
        throw new Error(voteRes.data.message || 'Vote submission failed');
      }

      console.log('✅ Vote cast successfully!');

      // ============================================
      // STEP 6: Handle Post-Vote flow
      // ============================================
      const voteResponseData = voteRes.data.data || voteRes.data;
      
      if (voteResponseData.verificationToken) {
        setVerificationToken(voteResponseData.verificationToken);
        const expiryTime = Date.now() + (2 * 60 * 1000);
        setVerificationExpiry(expiryTime);
      }

      setVoteID(generatedVoteID);
      setVoteSuccess(true);
      fetchReceipt(election.id, generatedVoteID);

    } catch (err) {
      console.error('❌ Vote failed:', err);
      setError(err.response?.data?.message || err.message || 'Vote failed');
    } finally {
      setIsVoting(false);
      setVotingStatus('');
    }
  };


  // Prevent rendering if no session
  if (!user || !election || !sessionID) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-8 font-sans">
      
      {/* Header */}
      <header className="max-w-5xl mx-auto mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              // Clear session on logout
              sessionStorage.removeItem('authToken');
              sessionStorage.removeItem('sessionID');
              navigate('/');
            }}
            className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{election.title}</h1>
            <p className="text-sm text-gray-500">Select your preferred candidate</p>
          </div>
        </div>

        {/* User Profile Badge + Session Timer */}
        <div className="flex items-center gap-3">
          {/* 🆕 Session Timer */}
          <div className="bg-white px-3 py-2 rounded-full shadow-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            <span className={`text-sm font-mono font-bold ${
              sessionTimeRemaining && sessionTimeRemaining < 120 ? 'text-red-600' : 'text-gray-700'
            }`}>
              {formatSessionTimer(sessionTimeRemaining)}
            </span>
          </div>

          {/* User Badge */}
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
                  ${voteSuccess ? 'opacity-50 cursor-not-allowed' : ''}
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
            <div className="col-span-full text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No candidates found for this election.</p>
            </div>
          )}
        </div>

        {/* Bottom Section - Vote Button */}
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
              className="w-full md:w-auto bg-gradient-to-r from-orange-500 to-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isVoting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {votingStatus || 'Casting Vote...'}
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Confirm Vote
                </>
              )}
            </button>
          </div>
        )}

        {/* Success Modal */}
          <VoteSuccessModal
            isOpen={voteSuccess}
            onClose={() => setVoteSuccess(false)}
            voteID={voteID}
            verificationToken={verificationToken}
            verificationExpiry={verificationExpiry}
            receipt={receipt}
            electionTitle={election?.title}
          />

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 max-w-md"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-medium text-sm">{error}</p>
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
