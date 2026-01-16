/**
 * VoteSuccessModal.jsx - Success Modal After Vote Cast
 * Shows both one-time token and permanent vote ID in a beautiful modal
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Clock, FileText, Shield, Copy, Home, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VoteSuccessModal({ 
  isOpen, 
  onClose, 
  voteID, 
  verificationToken, 
  verificationExpiry,
  receipt,
  electionTitle 
}) {
  const navigate = useNavigate();
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedVoteID, setCopiedVoteID] = useState(false);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(verificationToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyVoteID = () => {
    navigator.clipboard.writeText(voteID);
    setCopiedVoteID(true);
    setTimeout(() => setCopiedVoteID(false), 2000);
  };

  const handleGoHome = () => {
    onClose();
    navigate('/');
  };

  const handleVoteAgain = () => {
    onClose();
    window.location.reload();
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
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden pointer-events-auto max-h-[90vh] overflow-y-auto"
            >
              {/* 🎉 Success Header with Confetti Effect */}
              <div className="relative bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 p-8 text-white overflow-hidden">
                {/* Animated Background Circles */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24"></div>
                
                {/* Content */}
                <div className="relative z-10 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
                  >
                    <CheckCircle className="w-14 h-14 text-white" strokeWidth={3} />
                  </motion.div>
                  
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-4xl font-black mb-2"
                  >
                    Vote Cast Successfully! 🎉
                  </motion.h2>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-green-100 text-lg"
                  >
                    Your vote has been recorded on the blockchain
                  </motion.p>
                  
                  {electionTitle && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-4 inline-block px-4 py-2 bg-white/20 backdrop-blur-md rounded-full"
                    >
                      <p className="text-sm font-semibold">{electionTitle}</p>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-8 space-y-6">
                {/* Info Banner */}
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>📝 Important:</strong> Save both values below. The token shows your choice (2-min only), 
                    the Vote ID verifies blockchain confirmation (permanent).
                  </p>
                </div>

                {/* 🎫 One-Time Verification Token Card */}
                {verificationToken && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-orange-900 mb-1 flex items-center gap-2">
                          🎫 One-Time Verification Token
                          <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full text-xs font-bold">
                            2 MIN
                          </span>
                        </h3>
                        <p className="text-sm text-orange-700 mb-3">
                          Use this to verify your candidate choice. Valid for 2 minutes. Single use only!
                        </p>
                        
                        {/* Token Display */}
                        <div className="bg-white rounded-xl p-4 border-2 border-orange-200 shadow-inner">
                          <p className="text-xs text-gray-500 mb-2 font-semibold">Token:</p>
                          <p className="font-mono text-sm text-gray-900 break-all leading-relaxed">
                            {verificationToken}
                          </p>
                        </div>

                        {/* Copy Button */}
                        <button
                          onClick={handleCopyToken}
                          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                          {copiedToken ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Token
                            </>
                          )}
                        </button>

                        {/* Expiry Time */}
                        {verificationExpiry && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-orange-700 bg-orange-100 rounded-lg px-3 py-2">
                            <Clock className="w-4 h-4" />
                            <span>
                              Expires at: <strong>{new Date(verificationExpiry).toLocaleTimeString()}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 📋 Permanent Receipt (Vote ID) Card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-blue-900 mb-1 flex items-center gap-2">
                        📋 Permanent Receipt (Vote ID)
                        <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs font-bold">
                          FOREVER
                        </span>
                      </h3>
                      <p className="text-sm text-blue-700 mb-3">
                        Use this to verify your vote on blockchain. Valid forever. Does NOT show candidate choice.
                      </p>
                      
                      {/* Vote ID Display */}
                      <div className="bg-white rounded-xl p-4 border-2 border-blue-200 shadow-inner">
                        <p className="text-xs text-gray-500 mb-2 font-semibold">Vote ID:</p>
                        <p className="font-mono text-sm text-gray-900 break-all leading-relaxed">
                          {voteID}
                        </p>
                      </div>

                      {/* Copy Button */}
                      <button
                        onClick={handleCopyVoteID}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                      >
                        {copiedVoteID ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy Vote ID
                          </>
                        )}
                      </button>

                      {/* Save Notice */}
                      <div className="mt-3 flex items-center gap-2 text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
                        <Shield className="w-4 h-4" />
                        <span>
                          💾 Save this ID for permanent verification
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* 🧾 Blockchain Receipt Preview (if available) */}
                {receipt && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200 rounded-2xl p-6 shadow-md"
                  >
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                      <Shield className="w-5 h-5 text-green-600" />
                      Blockchain Receipt
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Election:</span>
                        <span className="font-semibold text-gray-900">{receipt.electionId}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Vote ID:</span>
                        <span className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          {receipt.voteID}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Timestamp:</span>
                        <span className="font-semibold text-gray-900">
                          {new Date(receipt.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Status:</span>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                          {receipt.status || 'CONFIRMED'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-8 pt-0 flex gap-4">
                <button
                  onClick={handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-md hover:shadow-lg active:scale-95"
                >
                  <Home className="w-5 h-5" />
                  Back to Home
                </button>
                <button
                  onClick={handleVoteAgain}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <RefreshCw className="w-5 h-5" />
                  Vote Again
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
