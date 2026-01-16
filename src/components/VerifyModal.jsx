/**
 * VerifyModal.jsx - Updated for New Verification System
 * 
 * Features:
 * 1. Permanent Receipt - Uses voteID (receipt-free, no candidate shown)
 * 2. One-Time Token - Uses verification token (shows candidate, 2-min window)
 * 
 * UI Design: Maintained from original version
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, CheckCircle, XCircle, Loader2, FileText, Clock, Shield } from 'lucide-react';
import apiClient from '../api/client';

export default function VerifyModal({ isOpen, onClose }) {
  // Verification Mode
  const [verificationType, setVerificationType] = useState('receipt'); // 'receipt' or 'token'
  
  // Permanent Receipt Fields
  const [voteID, setVoteID] = useState('');
  const [electionId, setElectionId] = useState('');
  
  // One-Time Token Field
  const [verificationToken, setVerificationToken] = useState('');
  
  // Common State
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  // Handle Permanent Receipt Verification
  const handleReceiptVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');
    setVerifyResult(null);
    setVerifying(true);

    try {
      const res = await apiClient.get(`/votes/receipt/${electionId}/${voteID}`);
      if (res.data.success) {
        setVerifyResult({
          type: 'receipt',
          data: res.data.data
        });
      }
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Vote not found on blockchain');
    } finally {
      setVerifying(false);
    }
  };

  // Handle One-Time Token Verification
  const handleTokenVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');
    setVerifyResult(null);
    setVerifying(true);

    try {
      const res = await apiClient.get(`/votes/verify-choice/${verificationToken}`);
      if (res.data.success) {
        setVerifyResult({
          type: 'token',
          data: res.data.data
        });
      }
    } catch (err) {
      if (err.response?.status === 410) {
        setVerifyError('⚠️ Token already used! Each token can only be verified once.');
      } else if (err.response?.status === 404) {
        setVerifyError('Invalid or expired verification token');
      } else {
        setVerifyError(err.response?.data?.message || 'Verification failed');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setVoteID('');
    setElectionId('');
    setVerificationToken('');
    setVerifyResult(null);
    setVerifyError('');
    setVerifying(false);
    onClose();
  };

  const handleTypeChange = (type) => {
    setVerificationType(type);
    setVerifyResult(null);
    setVerifyError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* Modal Panel */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Search className="w-5 h-5 text-green-600" />
                    Verify Vote
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Check vote on blockchain ledger</p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto">
                {/* Verification Type Toggle */}
                <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => handleTypeChange('receipt')}
                    className={`flex-1 py-2.5 px-3 rounded-lg font-medium transition-all text-sm ${
                      verificationType === 'receipt'
                        ? 'bg-white text-green-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline-block mr-1.5" />
                    Permanent Receipt
                  </button>
                  <button
                    onClick={() => handleTypeChange('token')}
                    className={`flex-1 py-2.5 px-3 rounded-lg font-medium transition-all text-sm ${
                      verificationType === 'token'
                        ? 'bg-white text-orange-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Clock className="w-4 h-4 inline-block mr-1.5" />
                    One-Time Token
                  </button>
                </div>

                {/* Info Banner */}
                <div className={`mb-6 p-3 rounded-xl border ${
                  verificationType === 'receipt'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <p className={`text-xs ${
                    verificationType === 'receipt' ? 'text-blue-800' : 'text-orange-800'
                  }`}>
                    {verificationType === 'receipt' ? (
                      <>
                        <strong>📋 Permanent Receipt:</strong> Verify your vote was recorded. 
                        <span className="font-semibold"> Candidate choice NOT shown</span> (prevents coercion).
                      </>
                    ) : (
                      <>
                        <strong>🎫 One-Time Verification:</strong> Verify your candidate choice. 
                        <span className="font-semibold"> Valid for 2 minutes, single use only.</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Permanent Receipt Form */}
                {verificationType === 'receipt' && (
                  <form onSubmit={handleReceiptVerify} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Election ID
                      </label>
                      <input
                        type="text"
                        value={electionId}
                        onChange={(e) => setElectionId(e.target.value)}
                        placeholder="e.g., secure-election1-2025"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm text-black transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vote ID
                      </label>
                      <input
                        type="text"
                        value={voteID}
                        onChange={(e) => setVoteID(e.target.value)}
                        placeholder="VOTE_abc123..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm text-black transition-all"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={verifying || !voteID || !electionId}
                      className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all font-medium shadow-lg shadow-green-600/20"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Shield className="w-5 h-5" />
                          Verify on Ledger
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* One-Time Token Form */}
                {verificationType === 'token' && (
                  <form onSubmit={handleTokenVerify} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Verification Token
                      </label>
                      <input
                        type="text"
                        value={verificationToken}
                        onChange={(e) => setVerificationToken(e.target.value)}
                        placeholder="TOKEN_abc123..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm text-black transition-all"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={verifying || !verificationToken}
                      className="w-full bg-orange-600 text-white py-3 rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all font-medium shadow-lg shadow-orange-600/20"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Clock className="w-5 h-5" />
                          Verify Choice (One-Time)
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Error State */}
                {verifyError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3"
                  >
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900 text-sm">Verification Failed</h3>
                      <p className="text-red-700 text-xs mt-1">{verifyError}</p>
                    </div>
                  </motion.div>
                )}

                {/* Success State - Permanent Receipt */}
                {verifyResult && verifyResult.type === 'receipt' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-5 bg-green-50 border border-green-100 rounded-xl"
                  >
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-green-100">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-green-900">Vote Verified</h3>
                        <p className="text-xs text-green-700">Confirmed on Blockchain</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Vote ID</span>
                        <span className="font-medium text-gray-900 font-mono text-xs">
                          {verifyResult.data.voteID}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Election</span>
                        <span className="font-medium text-gray-900">{verifyResult.data.electionId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Status</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                          {verifyResult.data.status || 'CONFIRMED'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Time</span>
                        <span className="font-medium text-gray-900">
                          {new Date(verifyResult.data.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      {/* Receipt-Free Notice */}
                      <div className="pt-3 mt-3 border-t border-green-100">
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                          <p className="text-xs text-yellow-800">
                            ⚠️ <strong>Receipt-Free Design:</strong> Your candidate choice is not shown 
                            in the permanent receipt to prevent vote buying and coercion.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Success State - One-Time Token */}
                {verifyResult && verifyResult.type === 'token' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-5 bg-orange-50 border border-orange-100 rounded-xl"
                  >
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-orange-100">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-orange-900">Candidate Verified</h3>
                        <p className="text-xs text-orange-700">Your choice confirmed</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-white border-2 border-orange-300 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-600 mb-2">You voted for:</p>
                        <p className="text-2xl font-bold text-orange-900">{verifyResult.data.candidateId}</p>
                      </div>
                      
                      {/* One-Time Warning */}
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <p className="text-xs text-red-800">
                          ⚠️ <strong>This token is now used!</strong> You cannot verify your choice again. 
                          Use your Vote ID for permanent verification (without candidate info).
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
