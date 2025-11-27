import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Fingerprint, ArrowRight, ChevronDown, BarChart2, Loader2, UserCheck, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/client';
import { generateVoterProofs } from '../lib/crypto';
import ResultsModal from '../components/ResultsModal';

export default function VoterLogin() {
  const navigate = useNavigate();
  
  // Form State
  const [aadhaar, setAadhaar] = useState('');
  const [voterId, setVoterId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Identity Verification State
  const [verifiedIdentity, setVerifiedIdentity] = useState(null); // { name, state }
  const [showIdentityModal, setShowIdentityModal] = useState(false);

  // Election State
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Results Modal State
  const [showResults, setShowResults] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // 1. Fetch Elections on Mount
  useEffect(() => {
    const fetchElections = async () => {
      try {
        const res = await apiClient.get('/elections/active');
        if (res.data.success) {
          setElections(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedElection(res.data.data[0]); // Default to first election
          }
        }
      } catch (err) {
        console.error('Failed to fetch elections:', err);
        setError('Unable to load elections. Please check your connection.');
      }
    };
    fetchElections();
  }, []);

  // 2. STEP 1: Verify Identity via API
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
      // Call the Identity Verification API
      const res = await apiClient.post('/identity/verify', {
        aadhaar,
        voterId
      });

      if (res.data.success) {
        // Success! Show the confirmation modal
        setVerifiedIdentity(res.data.data); // { name: "Alice3", state: "Chennai, India" }
        setShowIdentityModal(true);
      } else {
        setError('Identity verification failed. Please check your details.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.response?.data?.message || 'Identity verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. STEP 2: Generate Proofs & Login (Called from Modal)
  const handleConfirmLogin = async () => {
    setIsLoading(true);
    setShowIdentityModal(false); // Close modal
    
    try {
      // Generate Zero-Knowledge Proofs (Client-side)
      const proofs = await generateVoterProofs(aadhaar, voterId, verifiedIdentity.name);
      
      console.log('🔐 Proofs Generated:', proofs);
      
      // Construct the User Object for the Dashboard
      const userObject = {
        name: verifiedIdentity.name,
        state: verifiedIdentity.state,
        voterProof: proofs.voterProof,
        hashedAadhaar: proofs.hashedAadhaar,
        hashedVoterID: proofs.hashedVoterID,
        hashedName: proofs.hashedName
      };

      // Navigate to Vote Page
      navigate('/vote', {
        state: { 
          user: userObject, 
          election: selectedElection 
        }
      });

    } catch (err) {
      console.error('Login processing error:', err);
      setError('An error occurred while securing your session.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Fetch Results for Modal
  const handleShowResults = async () => {
    if (!selectedElection) return;
    
    setIsLoadingResults(true);
    setShowResults(true);
    
    try {
      const res = await apiClient.get(`/votes/${selectedElection.id}`);
      if (res.data.success) {
        const data = res.data.data;
        const results = data.results || {};
        setResultsData(results);
      }
    } catch (err) {
      console.error('Failed to load results:', err);
      setResultsData({});
    } finally {
      setIsLoadingResults(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      
      {/* Left Panel - Hero Section */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden flex-col justify-between p-12 text-white"style={{ backgroundImage: "url('/india-gate.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Fingerprint className="w-10 h-10" />
            <h1 className="text-3xl font-bold tracking-tight">SecureVote</h1>
          </div>
          <h2 className="text-5xl font-extrabold leading-tight mb-6">
            <span className="text-[#FF6820]">Your Vote</span>{' '}
            <span className="text-white">is</span>
            <br />
            <span className="text-green-400">Your Voice.</span>
          </h2>
          <p className="text-orange-100 text-lg max-w-md">
            Blockchain-enabled secure voting system ensuring transparency, anonymity, and immutability.
          </p>
        </div>
        <div className="relative z-10 text-sm text-orange-200">
          © 2025 Election Commission of India (Blockchain Division)
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        
        {/* Header Actions (Results Button) */}
        <div className="p-6 flex justify-end">
           <button
            onClick={handleShowResults}
            disabled={!selectedElection}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-md
              ${selectedElection 
                ? 'bg-white text-orange-600 border border-orange-100 hover:bg-orange-50' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
            `}
          >
            <BarChart2 className="w-4 h-4" />
            Live Results
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 sm:p-12">
          <div className="w-full max-w-md space-y-8">
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
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden"
                  >
                    {elections.map(election => (
                      <div 
                        key={election.id}
                        onClick={() => {
                          setSelectedElection(election);
                          setIsDropdownOpen(false);
                        }}
                        className="px-4 py-3 hover:bg-orange-50 cursor-pointer flex flex-col"
                      >
                        <span className="font-bold text-gray-800">{election.title}</span>
                        <span className="text-xs text-gray-500">ID: {election.id}</span>
                      </div>
                    ))}
                    {elections.length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm">No active elections</div>
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
                disabled={isLoading}
                className="w-full flex items-center justify-center bg-orange-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-orange-600/30 hover:bg-orange-700 hover:shadow-orange-600/40 transition-all active:scale-95"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>
            </form>
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

                <div className="pt-2 flex gap-3">
                  <button 
                    onClick={() => setShowIdentityModal(false)}
                    className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Nope
                  </button>
                  <button 
                    onClick={handleConfirmLogin}
                    className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-orange-700 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ResultsModal 
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        results={resultsData}
        isLoading={isLoadingResults}
      />
      
    </div>
  );
}
