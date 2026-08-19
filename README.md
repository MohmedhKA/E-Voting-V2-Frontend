
<div align="center">

# 🗳️ E-Voting Blockchain - Frontend

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-7.2.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.1.17-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Framer_Motion-12.23.24-FF0055?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion" />
</p>

**A modern, secure, and user-friendly frontend for the E-Voting Blockchain system built with React, Vite, and Hyperledger Fabric integration.**

[📚 Documentation](#-documentation) • [🚀 Quick Start](#-quick-start) • [✨ Features](#-features) • [🏗️ Architecture](#️-architecture)

</div>

---

## 📖 **About**

The **E-Voting V2 Frontend** is a sleek React-based web application that provides an intuitive interface for blockchain-powered electronic voting. Built with modern web technologies, it ensures **security, transparency, and accessibility** for all users.

### 🎯 **Key Highlights**

- 🔐 **Secure Authentication** - Role-based access for Admins and Voters
- 🗳️ **Real-time Voting** - Live election participation with instant feedback
- 📊 **Live Results** - Real-time vote tallying from blockchain
- 🎨 **Modern UI/UX** - Smooth animations with Framer Motion
- 📱 **Responsive Design** - Works seamlessly on all devices
- ⚡ **Lightning Fast** - Powered by Vite for instant HMR

---

## ✨ **Features**

### 👥 **For Voters**
- ✅ Login with Voter ID and Aadhar verification
- 🗳️ Select active elections from dropdown
- 🎯 Cast votes with visual candidate cards
- 🔒 One vote per election enforcement
- ✨ Smooth, animated voting experience

### 👨‍💼 **For Admins**
- 🔑 Secure admin authentication
- 📝 Create new elections with candidates
- ⚙️ Activate/End elections
- 📊 View real-time voting statistics
- 👥 Monitor voter participation

### 🎨 **UI/UX Features**
- 🌈 Beautiful gradient backgrounds
- ✨ Smooth page transitions
- 🎭 Interactive hover effects
- 📱 Mobile-first responsive design
- 🎬 Framer Motion animations

---

## 🛠️ **Tech Stack**

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 19.2.0 | UI Library |
| **Vite** | 7.2.4 | Build Tool & Dev Server |
| **TailwindCSS** | 4.1.17 | Utility-first CSS |
| **Framer Motion** | 12.23.24 | Animation Library |
| **React Router** | 7.9.6 | Client-side Routing |
| **Axios** | 1.13.2 | HTTP Client |
| **Lucide React** | 0.554.0 | Icon Library |

---

## 🚀 **Quick Start**

### 📋 **Prerequisites**

- Node.js (v18 or higher)
- npm or yarn
- Backend API running ([E-Voting-V2](https://github.com/MohmedhKA/E-Voting-V2))

### ⚙️ **Installation**

1. **Clone the repository**
```
git clone https://github.com/MohmedhKA/E-Voting-V2-Frontend.git
cd E-Voting-V2-Frontend
```

2. **Install dependencies**
```
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

4. **Start development server**
```
npm run dev
```

The app will be available at `http://localhost:5173` 🎉

---

## 📁 **Project Structure**

```
E-Voting-V2-Frontend/
├── public/              # Static assets
├── src/
│   ├── api/            # API client configuration
│   ├── assets/         # Images, fonts, etc.
│   ├── components/     # Reusable UI components
│   ├── lib/           # Utility functions
│   ├── pages/         # Page components
│   │   ├── AdminLogin.jsx
│   │   ├── VoterLogin.jsx
│   │   ├── VotingDashboard.jsx
│   │   └── AdminDashboard.jsx
│   ├── App.jsx        # Main app component
│   ├── main.jsx       # Entry point
│   └── index.css      # Global styles
├── .env               # Environment variables
├── package.json       # Dependencies
├── vite.config.js     # Vite configuration
└── tailwind.config.js # Tailwind configuration
```

---

## 🏗️ **Architecture**

### **Component Hierarchy**

```
App
├── AdminLogin
│   └── AdminDashboard
│       ├── CreateElection
│       ├── ManageElections
│       └── ViewResults
└── VoterLogin
    └── VotingDashboard
        ├── CandidateCard
        ├── VoteConfirmation
        └── SuccessMessage
```

### **Data Flow**

```
┌─────────────┐      HTTP/REST      ┌─────────────┐
│   Frontend  │ ◄─────────────────► │   Backend   │
│   (React)   │      (Axios)        │   (Node.js) │
└─────────────┘                     └─────────────┘
                                           │
                                           │ Fabric SDK
                                           ▼
                                    ┌─────────────┐
                                    │  Blockchain │
                                    │  (Fabric)   │
                                    └─────────────┘
```

---

## 📜 **Available Scripts**

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint checks |

---

## 🔗 **API Integration**

### **Base URL Configuration**

```
// src/api/client.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default apiClient;
```

### **Key Endpoints Used**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/elections/active` | GET | Fetch active elections |
| `/voters/login` | POST | Voter authentication |
| `/voters/vote` | POST | Cast vote |
| `/admins/login` | POST | Admin authentication |
| `/elections` | POST | Create election |
| `/elections/:id/activate` | PATCH | Activate election |

---

## 🎨 **Styling Guide**

### **Color Palette**

```
/* Primary Gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Success States */
--success-green: #10b981;
--success-light: #d1fae5;

/* Error States */
--error-red: #ef4444;
--error-light: #fee2e2;

/* Neutral Colors */
--gray-50: #f9fafb;
--gray-800: #1f2937;
```

### **Animation Examples**

```
// Framer Motion variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  },
  hover: { 
    scale: 1.05,
    transition: { duration: 0.3 }
  }
};
```

---

## 🔒 **Security Features**

- ✅ Environment variables for sensitive config
- ✅ HTTPS-only API communication
- ✅ Input validation on all forms
- ✅ CSRF protection via backend
- ✅ Role-based access control
- ✅ Secure session management

---

## 🤝 **Contributing**

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 **License**

This project is part of the E-Voting Blockchain system.

---

## 👨‍💻 **Author**

**Mohammed KA**

- GitHub: [@MohmedhKA](https://github.com/MohmedhKA)
- LinkedIn: [Mohmedh K A](https://www.linkedin.com/in/mohmedh-k-a-9873242a6/)

---

## 🙏 **Acknowledgments**

- React Team for the amazing framework
- Vite for blazing-fast development
- TailwindCSS for utility-first styling
- Framer Motion for smooth animations
- Hyperledger Fabric for blockchain infrastructure

---

## 🔗 **Related Repositories**

- 🔙 **Backend**: [E-Voting-V2](https://github.com/MohmedhKA/E-Voting-V2)
- ⛓️ **Blockchain Chaincode**: Check backend repo for chaincode

---

<div align="center">

**Made with ❤️ for secure and transparent elections**

⭐ **Star this repo if you find it helpful!** ⭐

</div>
```