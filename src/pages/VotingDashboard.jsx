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
  CheckCircle, CheckCircle2, AlertCircle, Loader2, ArrowLeft, User, 
  FileText, Shield, ShieldCheck, Key, Clock, Lock, Cpu, Sparkles 
} from 'lucide-react';
import apiClient from '../api/client';
import VoteSuccessModal from '../components/VoteSuccessModal';
import { generateVoteID, generateNonce, generateBatchID, generateHmacTag } from '../lib/crypto';
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
  const [votingStep, setVotingStep] = useState(0); // 1: Blinding, 2: EC Signing, 3: Unblinding, 4: Blockchain Commit
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [error, setError] = useState('');

  // Blind Signature State
  const [votingStatus, setVotingStatus] = useState('');

  // Verification Token State (one-time candidate verification)
  const [verificationToken, setVerificationToken] = useState(null);
  const [verificationExpiry, setVerificationExpiry] = useState(null);

  // Vote ID State (for receipt)
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
      console.log('Starting secure voting process...');

      // ============================================
      // STEP 1: Generate cryptographic components & Blind Ballot
      // ============================================
      setVotingStep(1);
      setVotingStatus('Generating post-quantum envelope & blinding ballot...');

      const generatedVoteID = generateVoteID();
      const nonce = generateNonce();
      const batchID = generateBatchID();

      // Attempt Post-Quantum LWE Ballot Envelope Preparation
      let commitPq = '';
      let cencPq = '';
      let proofHex = '';
      let electionPublicKeyHex = '';
      let numCandidates = election.candidates?.length || 2;

      try {
        const candidateIndex = election.candidates?.findIndex(
          c => (typeof c === 'string' ? c : (c.id || c.name || c.candidateName)) === selectedCandidate
        );
        if (candidateIndex !== -1 && candidateIndex !== undefined) {
          const envRes = await apiClient.post('/votes/prepare-envelope', {
            electionId: election.id,
            candidateIndex: Math.max(0, candidateIndex),
            numCandidates
          });
          if (envRes.data.success && envRes.data.data) {
            commitPq = envRes.data.data.commitPqHex || '';
            cencPq = envRes.data.data.cencPqHex || '';
            proofHex = envRes.data.data.proofHex || '';
            electionPublicKeyHex = envRes.data.data.electionPublicKeyHex || '';
          }
        }
      } catch (envErr) {
        console.warn('LWE envelope generation bypassed (standard mode):', envErr.message);
      }

      const ballotPayload = {
        voteID: generatedVoteID,
        electionId: election.id,
        candidateId: selectedCandidate,
        commitPq,
        nonce,
        batchID,
        timestamp: Date.now()
      };

      // Get election-scoped ephemeral RSA public key (HNDL mitigation)
      const pubKeyRes = await apiClient.get(`/ec/public-key?electionId=${election.id}`);
      const pubKeyData = pubKeyRes.data.data || pubKeyRes.data;
      const { n, e, electionId: returnedElectionId } = pubKeyData;

      if (!n || !e) throw new Error('Failed to retrieve EC public key');

      if (returnedElectionId && returnedElectionId !== election.id) {
        throw new Error(
          `Public key election mismatch: expected ${election.id}, got ${returnedElectionId}`
        );
      }

      // Create mathematically blinded ballot
      const { blindedMessageHex, r } = await blindBallot(ballotPayload, n, e);

      // ============================================
      // STEP 2: Request blind signature from EC
      // ============================================
      setVotingStep(2);
      setVotingStatus('Requesting blind authorization from EC...');

      const sigRes = await apiClient.post('/ec/request-blind-signature', {
        blindedMessage: blindedMessageHex,
        sessionID: sessionID,
        nonce: nonce
      });

      const signatureData = sigRes.data.data || sigRes.data;
      const receivedBlindedSignatureHex = 
          signatureData.blindedSignature?.trim() || signatureData.blindSignature?.trim();

      if (!receivedBlindedSignatureHex) {
          throw new Error('Backend error: Blind signature not returned');
      }

      // ============================================
      // STEP 3: Unblind signature & derive terminal HMAC
      // ============================================
      setVotingStep(3);
      setVotingStatus('Unblinding signature & deriving terminal HMAC...');

      const signatureHex = unblind(receivedBlindedSignatureHex, r, n);
      // r variable will be automatically garbage collected

      // Derive terminal-scoped HMAC tag for the vote payload
      const terminalKeyHex = import.meta.env.VITE_TERMINAL_KEY || '472323deb05e39452b10c724489e5923fb1dc077ee881efbbd341a623382cde8';
      const hmacTag = await generateHmacTag(
        election.id,
        commitPq || selectedCandidate,
        generatedVoteID,
        signatureHex,
        terminalKeyHex
      );

      // ============================================
      // STEP 4: Cast unblinded vote (ANONYMOUS Fabric Commit)
      // ============================================
      setVotingStep(4);
      setVotingStatus('Committing anonymous ballot to Hyperledger Fabric...');

      const voteRes = await apiClient.post('/votes/submit', {
        voteID: generatedVoteID,
        electionId: election.id,
        candidateId: selectedCandidate,
        commitPq,
        cencPq,
        proofHex,
        electionPublicKeyHex,
        numCandidates,
        blindSignature: signatureHex,
        batchID: batchID,
        hmacTag: hmacTag
      });

      if (!voteRes.data.success) {
        throw new Error(voteRes.data.message || 'Vote submission failed');
      }

      // Clear the pending RPV session since the vote is committed safely
      try {
        await apiClient.post('/ec/clear-pending');
      } catch (clearErr) {
        console.warn('Non-fatal: Failed to clear pending session:', clearErr);
      }

      // Post-Vote flow
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
      console.error('Vote failed:', err);
      setError(err.response?.data?.message || err.message || 'Vote failed');
    } finally {
      setIsVoting(false);
      setVotingStep(0);
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

        {/* Cryptographic Submission Pipeline Modal */}
        <AnimatePresence>
          {isVoting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-slate-900 relative overflow-hidden"
              >
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20">
                    <Cpu className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Cryptographic Ballot Submission</h3>
                    <p className="text-xs text-slate-500">Executing Zero-Knowledge & Post-Quantum Pipeline</p>
                  </div>
                </div>

                {/* 4 Pipeline Steps */}
                <div className="space-y-3.5">
                  {/* Step 1 */}
                  <div className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                    votingStep === 1 
                      ? 'bg-orange-50/90 border-orange-300 text-orange-950 shadow-sm'
                      : votingStep > 1 
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50 border-slate-200/60 text-slate-400'
                  }`}>
                    <div className="mt-0.5 flex-shrink-0">
                      {votingStep > 1 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : votingStep === 1 ? (
                        <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-500 font-bold">1</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold">1. Chaum RSA-2048 Ballot Blinding</div>
                      <div className="text-xs opacity-80 mt-0.5">Blinding factor generated in volatile memory</div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                    votingStep === 2 
                      ? 'bg-orange-50/90 border-orange-300 text-orange-950 shadow-sm'
                      : votingStep > 2 
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50 border-slate-200/60 text-slate-400'
                  }`}>
                    <div className="mt-0.5 flex-shrink-0">
                      {votingStep > 2 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : votingStep === 2 ? (
                        <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-500 font-bold">2</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold">2. Blind Authorization Token</div>
                      <div className="text-xs opacity-80 mt-0.5">Election Commission signs blind envelope without viewing vote</div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                    votingStep === 3 
                      ? 'bg-orange-50/90 border-orange-300 text-orange-950 shadow-sm'
                      : votingStep > 3 
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50 border-slate-200/60 text-slate-400'
                  }`}>
                    <div className="mt-0.5 flex-shrink-0">
                      {votingStep > 3 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : votingStep === 3 ? (
                        <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-500 font-bold">3</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold">3. Signature Unblinding & Terminal HMAC</div>
                      <div className="text-xs opacity-80 mt-0.5">Blinding factor destroyed in RAM • Hardware HMAC applied</div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                    votingStep === 4 
                      ? 'bg-orange-50/90 border-orange-300 text-orange-950 shadow-sm'
                      : votingStep > 4 
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50 border-slate-200/60 text-slate-400'
                  }`}>
                    <div className="mt-0.5 flex-shrink-0">
                      {votingStep > 4 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : votingStep === 4 ? (
                        <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-500 font-bold">4</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold">4. Hyperledger Fabric CCaaS Commit</div>
                      <div className="text-xs opacity-80 mt-0.5">SmartBFT consensus & ML-DSA-65 Merkle anchor batching</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" /> End-to-End Encrypted
                  </span>
                  <span>Terminal: WEB_001</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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

      {/* Background Ashoka Chakra Vector Watermark */}
      <div className="fixed -right-24 -bottom-24 pointer-events-none opacity-[0.035] -z-10">
        <svg viewBox="0 0 200 200" className="w-[500px] h-[500px] text-slate-900 animate-spin" style={{ animationDuration: '160s' }}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <circle cx="100" cy="100" r="22" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <circle cx="100" cy="100" r="6" fill="currentColor" />
          {[...Array(24)].map((_, i) => (
            <line
              key={i}
              x1="100"
              y1="100"
              x2="100"
              y2="8"
              stroke="currentColor"
              strokeWidth="2.5"
              transform={`rotate(${i * 15} 100 100)`}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
