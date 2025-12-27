import { useState } from 'react';
import { Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import apiClient from '../api/client';

export default function VerifyVote() {
    const [txId, setTxId] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        setResult(null);
        setVerifying(true);

        try {
            const res = await apiClient.get(`/votes/verify/${txId}`);
            
            if (res.data.success) {
                setResult(res.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
            <div className="max-w-2xl mx-auto">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-xl p-8"
                >
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <Search className="w-8 h-8 text-blue-600" />
                        Verify Your Vote
                    </h1>
                    <p className="text-gray-600 mb-6">
                        Enter your transaction ID to verify your vote exists on the blockchain
                    </p>

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
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                                minLength={64}
                                maxLength={64}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={verifying || txId.length !== 64}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {verifying ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <Search className="w-5 h-5" />
                                    Verify on Blockchain
                                </>
                            )}
                        </button>
                    </form>

                    {/* Error State */}
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                        >
                            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-red-800">Verification Failed</h3>
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Success State */}
                    {result && result.exists && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                                <h3 className="text-xl font-bold text-green-800">Vote Verified!</h3>
                            </div>
                            
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Election:</span>
                                    <span className="font-semibold text-gray-800">{result.electionId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Candidate Voted:</span>
                                    <span className="font-semibold text-gray-800">{result.candidate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Timestamp:</span>
                                    <span className="font-semibold text-gray-800">
                                        {new Date(result.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Transaction ID:</span>
                                    <span className="font-mono text-xs text-gray-600 break-all">{result.transactionId}</span>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-white rounded-lg border border-green-300">
                                <p className="text-xs text-green-800">
                                    ✅ This vote is permanently recorded on the Hyperledger Fabric blockchain and cannot be altered or deleted.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
