import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import apiClient from '../api/client';

export default function VerifyModal({ isOpen, onClose }) {
  const [txId, setTxId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');
    setVerifyResult(null);
    setVerifying(true);

    try {
      const res = await apiClient.get(`/votes/verify/${txId}`);
      if (res.data.success) {
        setVerifyResult(res.data.data);
      }
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Vote not found on blockchain');
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setTxId('');
    setVerifyResult(null);
    setVerifyError('');
    setVerifying(false);
    onClose();
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

          {/* Modal Panel - Centered like ResultsModal */}
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
                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction ID
                    </label>
                    <input
                      type="text"
                      value={txId}
                      onChange={(e) => setTxId(e.target.value)}
                      placeholder="Enter 64-character transaction ID"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm text-black transition-all"
                      required
                      minLength={64}
                      maxLength={64}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifying || txId.length !== 64}
                    className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all font-medium shadow-lg shadow-green-600/20"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify on Ledger
                      </>
                    )}
                  </button>
                </form>

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

                {/* Success State */}
                {verifyResult && verifyResult.exists && (
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
                        <span className="text-gray-500">Election</span>
                        <span className="font-medium text-gray-900">{verifyResult.electionId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Candidate</span>
                        <span className="font-bold text-gray-900">{verifyResult.candidate}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Time</span>
                        <span className="font-medium text-gray-900">
                          {new Date(verifyResult.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="pt-3 mt-3 border-t border-green-100">
                        <p className="text-xs text-gray-500 mb-1">Transaction ID</p>
                        <p className="text-xs font-mono text-black break-all bg-white p-2 rounded border border-green-100">
                          {verifyResult.transactionId}
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
