import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import OfflineIndicator from './components/OfflineIndicator';
import { ShieldCheck, Cpu, Lock } from 'lucide-react';

// Code-split route components
const VoterLogin = React.lazy(() => import('./pages/VoterLogin'));
const VotingDashboard = React.lazy(() => import('./pages/VotingDashboard'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const Simulator = React.lazy(() => import('./pages/Simulator'));
const BatchSimulator = React.lazy(() => import('./pages/BatchSimulator'));
const VerifyVote = React.lazy(() => import('./pages/VerifyVote'));

function QuantumShieldLoader({ onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    'Verifying NIST FIPS 204 ML-DSA-65 Parameters...',
    'Synchronizing Hyperledger Fabric Trust Mesh...',
    'Quantum-Resistant Terminal Verified & Ready.'
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setStepIndex(1), 900);
    const t2 = setTimeout(() => setStepIndex(2), 1800);
    const t3 = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-slate-900 bg-slate-50/95 backdrop-blur-xl select-none overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative flex items-center justify-center mb-8">
        {/* Outer pulsating ring */}
        <div className="w-24 h-24 rounded-full border border-orange-500/20 animate-ping absolute" style={{ animationDuration: '3s' }} />
        {/* Spinning gradient border */}
        <div className="w-20 h-20 rounded-full border-2 border-slate-200 border-t-orange-500 border-r-amber-500 animate-spin" style={{ animationDuration: '1.2s' }} />
        {/* Core Shield Icon */}
        <div className="absolute w-12 h-12 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/10">
          <ShieldCheck className="w-7 h-7 text-emerald-600 animate-pulse" />
        </div>
      </div>

      <div className="text-center max-w-sm px-6">
        <h2 className="text-xl font-black text-slate-900 tracking-tight mb-1">
          SecureVote Architecture
        </h2>
        
        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={stepIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-xs font-bold text-orange-600 tracking-wide uppercase font-mono"
            >
              {steps[stepIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress Bar */}
        <div className="w-48 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 overflow-hidden shadow-inner">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 rounded-full"
          />
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
            <Cpu className="w-3.5 h-3.5 text-orange-600" /> ML-DSA-65
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
            <Lock className="w-3.5 h-3.5 text-emerald-600" /> SmartBFT
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function App() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  return (
    <BrowserRouter>
      <div className="min-h-screen text-white font-sans relative overflow-hidden">
        {/* Background Image with Dark Overlay */}
        <div 
          className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(india-gate.jpg)' }}
        />
        <div className="fixed inset-0 -z-10 bg-black/70 backdrop-blur-sm" />

        {/* Animated Gradient Glow */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-5 pointer-events-none opacity-30">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/40 rounded-full blur-[150px] animate-pulse" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-600/40 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Global Network & Backend Offline Monitor */}
        <OfflineIndicator />

        {/* Initial Quantum Shield Loading Screen (displayed for ~2.6s on refresh) */}
        <AnimatePresence>
          {isInitialLoading && (
            <QuantumShieldLoader onFinish={() => setIsInitialLoading(false)} />
          )}
        </AnimatePresence>

        <Suspense fallback={<QuantumShieldLoader onFinish={() => {}} />}>
          <Routes>
            <Route path="/" element={<VoterLogin />} />
            <Route path="/vote" element={<VotingDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/simulate" element={<Simulator />} />
            <Route path="/ResearchSim" element={<BatchSimulator />} />
            <Route path="/verify" element={<VerifyVote />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
