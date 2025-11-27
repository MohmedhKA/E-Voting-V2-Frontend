import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VoterLogin from './pages/VoterLogin';
import AdminDashboard from './pages/AdminDashboard';
import VotingDashboard from './pages/VotingDashboard';
import Simulator from './pages/Simulator';

function App() {
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

        <Routes>
          <Route path="/" element={<VoterLogin />} />
          <Route path="/vote" element={<VotingDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/simulate" element={<Simulator />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
