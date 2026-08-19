// client/src/pages/VoterLogin.jsx
// ✨ Updated Version: Added Session Creation + JWT Flow + OTP UX Fixes

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, Fingerprint, ArrowRight, ChevronDown, BarChart2, 
  Loader2, UserCheck, MapPin, Search, Mail, Clock, RefreshCw, ShieldCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/client';
import { generateVoterProofs } from '../lib/crypto';
import ResultsModal from '../components/ResultsModal';
import VerifyModal from '../components/VerifyModal';

export default function VoterLogin() {
  const navigate = useNavigate();
  
  // Form State
  const [aadhaar, setAadhaar] = useState('');
  const [voterId, setVoterId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Identity Verification State
  const [verifiedIdentity, setVerifiedIdentity] = useState(null);
  const [showIdentityModal, setShowIdentityModal] = useState(false);

  // OTP State
  const [showOTPStep, setShowOTPStep] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [otpTimer, setOtpTimer] = useState(0);
  const [isResendingOTP, setIsResendingOTP] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);

  // Session State (for JWT authentication)
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Election State
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Results & Verify Modal State
  const [showResults, setShowResults] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // ============================================
  // 1. Fetch Elections on Mount
  // ============================================
  useEffect(() => {
    const fetchElections = async () => {
      try {
        const res = await apiClient.get('/elections/active');
        if (res.data.success && Array.isArray(res.data.data)) {
          // Deduplicate by ID and ensure active status
          const map = new Map();
          res.data.data.forEach(e => {
            const id = e.id || e._id;
            if (id && !map.has(id)) map.set(id, e);
          });
          const activeList = Array.from(map.values()).filter(e => e.status === 'ACTIVE' || !e.status);
          setElections(activeList);
          if (activeList.length > 0) {
            setSelectedElection(activeList[0]);
          } else {
            setSelectedElection(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch elections:', err);
        setError('Unable to load elections. Please check your connection.');
      }
    };
    fetchElections();
  }, []);

  // ============================================
  // 2. OTP Timer Countdown
  // ============================================
  useEffect(() => {
    if (!otpExpiry) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((otpExpiry - now) / 1000));
      setOtpTimer(remaining);

      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [otpExpiry]);

  // ✅ NEW: Auto-focus first OTP input when OTP step shows
  useEffect(() => {
    if (showOTPStep) {
      setTimeout(() => {
        document.getElementById('otp-0')?.focus();
      }, 100);
    }
  }, [showOTPStep]);

  // Format timer: 09:45
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // 3. STEP 1: Verify Identity & Check Vote Status
  // ============================================
  const handleVerifyIdentity = async (e) => {
    e.preventDefault();
    setError('');
    setVerifiedIdentity(null);

    if (!aadhaar || !voterId) {
      setError('Please enter both Aadhaar and Voter ID');
      return;
    }
    
    if (!selectedElection) {
      setError('Please select an election to proceed');
      return;
    }

    setIsLoading(true);

    try {
      // STEP 1: Verify identity first
      const res = await apiClient.post('/identity/verify', { aadhaar, voterId });

      if (!res.data.success) {
        setError('Identity verification failed. Please check your details.');
        setIsLoading(false);
        return;
      }

      // Store verified identity
      const identityData = res.data.data; // { name, state, maskedEmail }
      
      // STEP 2: Generate proofs to check vote status
      const proofs = await generateVoterProofs(aadhaar, voterId, identityData.name);
      
      // STEP 3: Check if user has already voted BEFORE showing OTP
      const voterStatusRes = await apiClient.get(
        `/voters/${selectedElection.id}/${proofs.voterProof}`
      );

      if (voterStatusRes.data.success && voterStatusRes.data.hasVoted) {
        setError('You have already cast your ballot in this election.');
        setIsLoading(false);
        
        // ✅ FIX: Clear form after 5 seconds
        setTimeout(() => {
          setAadhaar('');
          setVoterId('');
          setError('');
          setVerifiedIdentity(null);
        }, 5000);
        
        return; // Stop here - don't proceed to OTP
      }

      // ✅ Identity verified AND not voted yet - proceed to OTP
      setVerifiedIdentity(identityData);
      setShowIdentityModal(true);

    } catch (err) {
      console.error('Verification error:', err);
      setError(err.response?.data?.message || 'Identity verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // 4. STEP 2: Send OTP
  // ============================================
  const handleSendOTP = async () => {
    setShowIdentityModal(false);
    setIsSendingOTP(true);
    setError('');

    try {
      const res = await apiClient.post('/identity/send-otp', { aadhaar, voterId });

      if (res.data.success) {
        const expiryMinutes = res.data.data.expiryMinutes || 10;
        const expiryTime = Date.now() + expiryMinutes * 60 * 1000;
        setOtpExpiry(expiryTime);
        setShowOTPStep(true);
        console.log(`✅ OTP sent to ${res.data.data.maskedEmail}`);
      } else {
        setError('Failed to send OTP. Please try again.');
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      setError(err.response?.data?.message || 'Failed to send OTP');
      setShowIdentityModal(true);
    } finally {
      setIsSendingOTP(false);
    }
  };

  // ============================================
  // 5. STEP 3: Verify OTP & Create Session
  // ============================================
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);

    try {
      // STEP 3A: Verify OTP first
      const otpRes = await apiClient.post('/identity/verify-otp', {
        aadhaar,
        voterId,
        otp: otpString,
      });

      if (!otpRes.data.success) {
        setError('Invalid OTP. Please try again.');
        setIsLoading(false);
        return;
      }

      console.log('✅ OTP verified successfully');

      // 🆕 STEP 3B: Create secure session and get JWT token
      setIsCreatingSession(true);
      console.log('🔐 Creating secure session...');

      const sessionRes = await apiClient.post('/ec/create-session', {
        aadhaar,
        voterId,
        fingerprintVerified: true,
        otpVerified: true,
        electionId: selectedElection.id
      });

      console.log('📦 Full session response:', sessionRes.data);

      if (!sessionRes.data.success) {
        setError(sessionRes.data.message || 'Failed to create session. Please try again.');
        setIsLoading(false);
        setIsCreatingSession(false);
        return;
      }

      // Handle both response formats
      const sessionData = sessionRes.data.data || sessionRes.data;
      const newSessionID = sessionData.sessionID;
      const newAuthToken = sessionData.authToken;
      const expiresAt = sessionData.expiresAt;

      // Validate session data
      if (!newSessionID || !newAuthToken) {
        console.error('❌ Session creation failed - missing required fields:', {
          hasSessionID: !!newSessionID,
          hasAuthToken: !!newAuthToken,
          hasExpiresAt: !!expiresAt,
          receivedData: sessionData
        });
        
        setError('Backend error: Session data incomplete. Check backend logs.');
        setIsLoading(false);
        setIsCreatingSession(false);
        return;
      }

      console.log('✅ Session created:', {
        sessionID: newSessionID,
        expiresAt: expiresAt ? new Date(expiresAt).toLocaleTimeString() : 'N/A',
        hasToken: !!newAuthToken,
        tokenPreview: newAuthToken ? newAuthToken.substring(0, 20) + '...' : 'none'
      });

      // Store JWT in sessionStorage
      sessionStorage.setItem('authToken', newAuthToken);
      sessionStorage.setItem('sessionID', newSessionID);
      if (expiresAt) {
        sessionStorage.setItem('sessionExpiry', expiresAt);
      }

      console.log('💾 Session data stored in sessionStorage');

      // STEP 3C: Generate voter proofs for voting
      const proofs = await generateVoterProofs(aadhaar, voterId, verifiedIdentity.name);

      // STEP 3D: Final check - make sure they haven't voted during this process
      const voterStatusRes = await apiClient.get(
        `/voters/${selectedElection.id}/${proofs.voterProof}`
      );

      if (voterStatusRes.data.success && voterStatusRes.data.hasVoted) {
        setError('You have already voted in this election.');
        setIsLoading(false);
        setIsCreatingSession(false);
        return;
      }

      // STEP 3E: Navigate to voting page with session data
      const userObject = {
        name: verifiedIdentity.name,
        state: verifiedIdentity.state,
        voterProof: proofs.voterProof,
        hashedAadhaar: proofs.hashedAadhaar,
        hashedVoterID: proofs.hashedVoterID,
        hashedName: proofs.hashedName,
      };

      console.log('🚀 Navigating to voting dashboard with session:', {
        hasSessionID: !!newSessionID,
        hasAuthToken: !!newAuthToken,
        hasExpiry: !!expiresAt
      });

      navigate('/vote', {
        state: {
          user: userObject,
          election: selectedElection,
          sessionID: newSessionID,
          authToken: newAuthToken,
          sessionExpiry: expiresAt
        },
      });

    } catch (err) {
      console.error('❌ Login error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
      setIsCreatingSession(false);
    }
  };

  // ============================================
  // 6. Resend OTP (IMPROVED)
  // ============================================
  const handleResendOTP = async () => {
    setIsResendingOTP(true);
    setError('');
    setOtp(['', '', '', '', '', '']);

    // ✅ Focus first input after clearing
    setTimeout(() => {
      document.getElementById('otp-0')?.focus();
    }, 100);

    try {
      const res = await apiClient.post('/identity/send-otp', { aadhaar, voterId });

      if (res.data.success) {
        const expiryMinutes = res.data.data.expiryMinutes || 10;
        const expiryTime = Date.now() + expiryMinutes * 60 * 1000;
        setOtpExpiry(expiryTime);
        
        // Show toast notification
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-emerald-600 text-white font-medium px-6 py-3 rounded-xl shadow-xl z-50 animate-slide-in flex items-center gap-2';
        toast.textContent = 'New OTP sent to your registered email';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        
      } else {
        setError('Failed to resend OTP. Please try again.');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setIsResendingOTP(false);
    }
  };

  // ============================================
  // 7. Handle OTP Input (IMPROVED - Fixed UX Issues)
  // ============================================
  
  // ✅ NEW: Handle paste event (paste full 6-digit OTP)
  const handleOTPPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Only accept 6-digit numbers
    if (!/^\d{6}$/.test(pastedData)) {
      setError('Invalid OTP format. Please paste a valid 6-digit code.');
      return;
    }
    
    // Split pasted OTP into array
    const newOTP = pastedData.split('');
    setOtp(newOTP);
    
    // Focus last input
    document.getElementById('otp-5')?.focus();
    
    // Clear error
    setError('');
    
    console.log('✅ OTP pasted successfully');
  };

  // ✅ IMPROVED: Better input handling
  const handleOTPChange = (index, value) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newOTP = [...otp];
    
    // Handle multiple digits (Android auto-fill behavior)
    if (value.length > 1) {
      newOTP[index] = value.slice(-1);
    } else {
      newOTP[index] = value;
    }
    
    setOtp(newOTP);
    setError(''); // Clear error on input

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  // ✅ IMPROVED: Better keyboard navigation
  const handleOTPKeyDown = (index, e) => {
    // Backspace: Clear current and focus previous
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOTP = [...otp];
      
      if (otp[index]) {
        // Clear current box
        newOTP[index] = '';
        setOtp(newOTP);
      } else if (index > 0) {
        // Move to previous and clear it
        newOTP[index - 1] = '';
        setOtp(newOTP);
        document.getElementById(`otp-${index - 1}`)?.focus();
      }
    }
    
    // Arrow keys navigation
    if (e.key === 'ArrowLeft' && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  // ============================================
  // 8. Open Results Modal
  // ============================================
  const handleShowResults = () => {
    setShowResults(true);
  };

  // ============================================
  // 9. RENDER UI
  // ============================================
  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      
      {/* Left Panel - Hero Section */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden flex-col justify-between p-12 text-white" style={{ backgroundImage: "url('/india-gate.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"></div>

        {/* Ashoka Chakra Animated Arrival & Colorful Tricolor Aura */}
        <motion.div
          initial={{ scale: 0.2, opacity: 0, rotate: -120 }}
          animate={{ scale: 1, opacity: 0.85, rotate: 0 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute -right-16 -bottom-16 pointer-events-none select-none"
        >
          {/* Multi-color ambient glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-green-500/20 via-blue-600/20 to-orange-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />

          <svg viewBox="0 0 200 200" className="w-[420px] h-[420px] animate-spin" style={{ animationDuration: '100s' }}>
            <defs>
              <linearGradient id="chakraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF9933" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.85" />
              </linearGradient>
              <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0038A8" stopOpacity="0.4" />
              </radialGradient>
            </defs>

            {/* Outer Rim */}
            <circle cx="100" cy="100" r="92" fill="none" stroke="url(#chakraGrad)" strokeWidth="3" opacity="0.8" />
            <circle cx="100" cy="100" r="87" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            
            {/* Center Hub */}
            <circle cx="100" cy="100" r="22" fill="url(#hubGlow)" stroke="url(#chakraGrad)" strokeWidth="2.5" />
            <circle cx="100" cy="100" r="7" fill="#ffffff" opacity="0.9" />

            {/* 24 Dharma Spokes */}
            {[...Array(24)].map((_, i) => (
              <g key={i} transform={`rotate(${i * 15} 100 100)`}>
                <line
                  x1="100"
                  y1="100"
                  x2="100"
                  y2="10"
                  stroke="url(#chakraGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.8"
                />
                <circle cx="100" cy="12" r="1.5" fill="#38bdf8" opacity="0.9" />
              </g>
            ))}
          </svg>
        </motion.div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Fingerprint className="w-10 h-10 text-white" />
            <h1 className="text-3xl font-bold tracking-tight">SecureVote</h1>
          </div>

          <h2 className="text-6xl xl:text-7xl font-extrabold leading-[1.08] mb-6 tracking-tight">
            <span className="text-[#FF6820]">Your Vote</span>{' '}
            <span className="text-white">is</span>
            <br />
            <span className="text-green-400">Your Voice.</span>
          </h2>
          <p className="text-orange-100 text-lg sm:text-xl font-normal max-w-lg leading-relaxed">
            Blockchain-enabled secure voting system ensuring transparency, anonymity, and immutability.
          </p>

          {/* Cryptographic Protection Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-xs font-semibold text-white mt-8 shadow-inner">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>FIPS 204 Quantum Shield • Zero Knowledge</span>
          </div>
        </div>

        <div className="relative z-10 text-xs text-orange-200 flex items-center justify-between">
          <span>© 2026 Election Commission of India (Blockchain Division)</span>
          <span className="font-mono text-[10px] bg-white/10 px-2 py-0.5 rounded text-white">v2.1 PQ</span>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        
        {/* Header Actions */}
        <div className="p-6 flex justify-end gap-3">
          <button
            onClick={handleShowResults}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          >
            <BarChart2 className="w-4 h-4 text-blue-600" />
            Live Results
          </button>
          <button
            onClick={() => setShowVerifyModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-full hover:bg-green-100 transition-colors"
          >
            <Search className="w-4 h-4" />
            Verify Vote
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 sm:p-12">
          <div className="w-full max-w-md space-y-8">
            
            {/* Conditional Rendering: Show either Login Form or OTP Form */}
            {!showOTPStep ? (
              <>
                {/* STEP 1: Identity Verification Form */}
                <div className="text-center lg:text-left">
                  <h2 className="text-3xl font-bold text-gray-900">Voter Login</h2>
                  <p className="mt-2 text-gray-600">Enter your details to verify identity</p>
                </div>

                {/* Election Selector */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Election</label>
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 flex items-center justify-between hover:border-orange-500 transition-colors"
                  >
                    <span className={`font-medium ${selectedElection ? 'text-gray-900' : 'text-gray-500'}`}>
                      {selectedElection ? selectedElection.title : 'Select an active election'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto"
                      >
                        {elections.map(election => (
                          <div 
                            key={election.id || election._id}
                            onClick={() => {
                              setSelectedElection(election);
                              setIsDropdownOpen(false);
                            }}
                            className="px-4 py-3 hover:bg-orange-50 cursor-pointer flex flex-col border-b border-gray-50 last:border-0"
                          >
                            <span className="font-bold text-gray-800">{election.title}</span>
                            <span className="text-xs text-gray-500">ID: {election.id || election._id}</span>
                          </div>
                        ))}
                        {elections.length === 0 && (
                          <div className="p-4 text-center text-gray-500 text-sm">No active elections available for voting</div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Login Form */}
                <form onSubmit={handleVerifyIdentity} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Fingerprint className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={aadhaar}
                        onChange={(e) => setAadhaar(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        placeholder="Enter 12-digit Aadhaar"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Voter ID</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={voterId}
                        onChange={(e) => setVoterId(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        placeholder="Enter Voter ID Number"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || isSendingOTP}
                    className="w-full flex items-center justify-center bg-orange-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-orange-600/30 hover:bg-orange-700 hover:shadow-orange-600/40 transition-all active:scale-95"
                  >
                    {isLoading || isSendingOTP ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        {isSendingOTP ? 'Sending OTP...' : 'Verifying...'}
                      </>
                    ) : (
                      <>
                        Verify & Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                {/* STEP 2: OTP Verification Form */}
                <div className="text-center lg:text-left">
                  <h2 className="text-3xl font-bold text-gray-900">Enter OTP</h2>
                  <p className="mt-2 text-gray-600">
                    We've sent a 6-digit code to<br />
                    <span className="font-semibold text-orange-600">
                      {verifiedIdentity?.maskedEmail}
                    </span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  {/* OTP Input Boxes - ✅ FIXED WITH PASTE & AUTOCOMPLETE */}
                  <div className="flex justify-center gap-2">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        onPaste={(e) => handleOTPPaste(e)}
                        autoComplete="one-time-code"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        className="w-12 h-14 text-center text-black text-2xl font-bold bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    ))}
                  </div>

                  {/* Timer */}
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Clock className="w-5 h-5" />
                    <span className="font-mono text-lg">
                      {otpTimer > 0 ? formatTimer(otpTimer) : 'Expired'}
                    </span>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      {error}
                    </div>
                  )}

                  {/* Resend OTP */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={isResendingOTP || otpTimer > 540}
                      className="text-sm text-orange-600 hover:text-orange-700 disabled:text-gray-400 flex items-center justify-center gap-2 mx-auto font-medium"
                    >
                      <RefreshCw className={`w-4 h-4 ${isResendingOTP ? 'animate-spin' : ''}`} />
                      <span>{isResendingOTP ? 'Sending...' : 'Resend OTP'}</span>
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || otp.join('').length !== 6}
                    className="w-full flex items-center justify-center bg-orange-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-orange-600/30 hover:bg-orange-700 hover:shadow-orange-600/40 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        {isCreatingSession ? 'Creating Secure Session...' : 'Verifying OTP...'}
                      </>
                    ) : (
                      <>
                        Verify OTP & Login
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </button>

                  {/* Back Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOTPStep(false);
                      setOtp(['', '', '', '', '', '']);
                      setError('');
                    }}
                    className="w-full text-gray-600 hover:text-gray-900 font-medium"
                  >
                    ← Back to Login
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Identity Verification Modal */}
      <AnimatePresence>
        {showIdentityModal && verifiedIdentity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="bg-orange-600 p-6 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                  <UserCheck className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold">Identity Verified</h3>
                <p className="text-orange-100 text-sm">Please confirm your details</p>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xl">
                    {verifiedIdentity.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Voter Name</p>
                    <p className="text-lg font-bold text-gray-800">{verifiedIdentity.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Constituency / State</p>
                    <p className="text-lg font-bold text-gray-800">{verifiedIdentity.state}</p>
                  </div>
                </div>

                {verifiedIdentity.maskedEmail && (
                  <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email Address</p>
                      <p className="text-sm font-semibold text-orange-900">{verifiedIdentity.maskedEmail}</p>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button 
                    onClick={() => setShowIdentityModal(false)}
                    className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSendOTP}
                    disabled={isSendingOTP}
                    className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSendingOTP ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Send OTP
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Results Modal */}
      <ResultsModal 
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        electionId={selectedElection?.id}
      />
      
      {/* Verify Vote Modal */}
      <VerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
      />
    </div>
  );
}
