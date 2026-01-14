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
import { generateVoteID, createBlindedVote, generateNonce, generateBatchID } from '../lib/crypto';

// Helper to get random color for candidates based on index
const getCandidateColor = (index) => {
  const colors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-indigo-500'];
  return colors[index % colors.length];
};

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
  const [isRequestingSignature, setIsRequestingSignature] = useState(false);
  const [blindSignature, setBlindSignature] = useState(null);

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

    const timer = setInterval(() => {
      const now = Date.now();
      const expiry = new Date(sessionExpiry).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setSessionTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        alert('⚠️ Session expired! Please login again.');
        navigate('/');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionExpiry, navigate]);

  // Format session timer: 09:45
  const formatSessionTimer = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
  // 🆕 COMPLETELY REWRITTEN: Handle Vote with Blind Signature (FIXED!)
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

      // ============================================
      // STEP 2: Create blinded vote (EC can't see choice!)
      // ============================================
      const blindedVote = createBlindedVote(election.id, selectedCandidate);
      
      console.log('🎭 Created blinded vote:', blindedVote.substring(0, 30) + '...');

      // ============================================
      // STEP 3: Request blind signature from EC (FIXED!)
      // ============================================
      setIsRequestingSignature(true);
      console.log('📝 Requesting blind signature from EC...');

      const sigRes = await apiClient.post('/ec/request-blind-signature', {
        sessionID: sessionID,
        blindedVote: blindedVote,
        nonce: nonce
      });

      // 🔧 DEBUG: Log full response to see structure
      console.log('📦 Blind signature response:', sigRes.data);

      if (!sigRes.data.success) {
        throw new Error(sigRes.data.message || 'Blind signature request failed');
      }

      // 🔧 FIX: Handle both flat and nested response structures
      // Format 1: { success, blindSignature, auditID }
      // Format 2: { success, data: { blindSignature, auditID } }
      const signatureData = sigRes.data.data || sigRes.data;
      const receivedBlindSignature = signatureData.blindSignature;

      // 🔧 VALIDATE: Make sure we actually got the signature
      if (!receivedBlindSignature) {
        console.error('❌ Blind signature missing in response:', {
          fullResponse: sigRes.data,
          signatureData: signatureData
        });
        throw new Error('Backend error: Blind signature not returned');
      }

      setBlindSignature(receivedBlindSignature);
      setIsRequestingSignature(false);

      console.log('✅ Received blind signature:', receivedBlindSignature.substring(0, 30) + '...');

      // ============================================
      // STEP 4: Cast vote with blind signature (ANONYMOUS!)
      // ============================================
      console.log('📮 Casting anonymous vote...');

      const votePayload = {
        voteID: generatedVoteID,           // 🆕 Random ID (not linked to voter!)
        electionId: election.id,
        candidateId: selectedCandidate,
        blindSignature: receivedBlindSignature,  // 🆕 EC's signature
        batchID: batchID                   // 🆕 For anonymity set
        // ❌ NO hashedAadhaar!
        // ❌ NO voterProof!
        // ❌ NO hashedVoterID!
        // ❌ NOTHING that links to voter identity!
      };

      console.log('📦 Vote payload (ANONYMOUS):', {
        voteID: votePayload.voteID,
        electionId: votePayload.electionId,
        candidateId: votePayload.candidateId,
        hasBlindSignature: !!votePayload.blindSignature,
        batchID: votePayload.batchID
      });

      const voteRes = await apiClient.post('/votes', votePayload);

      // 🔧 DEBUG: Log vote response
      console.log('📦 Vote response:', voteRes.data);

      if (!voteRes.data.success) {
        throw new Error(voteRes.data.message || 'Vote submission failed');
      }

      console.log('✅ Vote cast successfully!');

      // ============================================
      // STEP 5: Store verification token (one-time use!)
      // ============================================
      const voteResponseData = voteRes.data.data || voteRes.data;
      
      if (voteResponseData.verificationToken) {
        setVerificationToken(voteResponseData.verificationToken);
        
        // Token expires in 2 minutes
        const expiryTime = Date.now() + (2 * 60 * 1000);
        setVerificationExpiry(expiryTime);
        
        console.log('🎫 Verification token received (2-min window):', 
          voteResponseData.verificationToken.substring(0, 20) + '...');
      }

      // ============================================
      // STEP 6: Store vote ID and trigger receipt fetch
      // ============================================
      setVoteID(generatedVoteID);
      setVoteSuccess(true);

      // Start polling for receipt (receipt-free - no candidate info!)
      fetchReceipt(election.id, generatedVoteID);

    } catch (err) {
      console.error('❌ Vote failed:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.message || err.message || 'Vote failed');
      setIsRequestingSignature(false);
    } finally {
      setIsVoting(false);
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
                  {isRequestingSignature ? 'Requesting Signature...' : 'Casting Vote...'}
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

        {/* 🆕 SUCCESS MODAL WITH VERIFICATION TOKEN */}
        <AnimatePresence>
          {voteSuccess && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Vote Confirmed!</h2>
                <p className="text-gray-600 mb-6">
                  Your vote has been securely recorded on the blockchain with <span className="font-bold">blind signature</span>.
                </p>

                {/* 🆕 Security Badges */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <Shield className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-blue-900">Anonymous</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <Key className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-purple-900">Blind Signed</p>
                  </div>
                </div>

                {/* 🆕 Verification Token Info */}
                {verificationToken && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-left">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-bold text-yellow-900 mb-1">One-Time Verification Available</p>
                        <p className="text-yellow-700">
                          You have a <span className="font-bold">2-minute window</span> to verify your candidate choice. 
                          This token can only be used <span className="font-bold">once</span>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Receipt Card */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Blockchain Receipt</h3>
                  </div>
                  
                  {isPollingReceipt ? (
                    <div className="flex items-center gap-2 text-gray-500 py-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Generating cryptographic proof...</span>
                    </div>
                  ) : receipt ? (
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Vote ID</span>
                        <p className="font-mono text-xs text-gray-800 break-all bg-white p-2 rounded border border-gray-200 mt-1">
                          {receipt.voteID || voteID}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-500 uppercase">Timestamp</span>
                        <span className="text-xs text-gray-800">
                          {new Date(receipt.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {/* 🆕 Receipt-Free Notice */}
                      <div className="bg-orange-50 border border-orange-200 rounded p-2">
                        <p className="text-xs text-orange-800">
                          ⚠️ <span className="font-bold">Receipt-Free:</span> Candidate choice not shown (prevents coercion)
                        </p>
                      </div>
                      <div className="mt-2 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified on Ledger
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-red-500 py-2">
                      Receipt generation timed out. Check your dashboard later.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    // Clear session on return home
                    sessionStorage.removeItem('authToken');
                    sessionStorage.removeItem('sessionID');
                    navigate('/');
                  }}
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
