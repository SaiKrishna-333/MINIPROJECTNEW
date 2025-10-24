# 🌾 Rural Gold Connect - P2P Lending Platform

> **Peer-to-peer lending with DigiLocker integration and advanced biometric security**

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green.svg)](https://www.mongodb.com/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow.js-4.x-orange.svg)](https://www.tensorflow.org/js)

---

## 🚀 Quick Start

```bash
# 1. Clone repository
git clone https://github.com/SaiKrishna-333/MINIPROJECTNEW.git
cd MINIPROJECTNEW

# 2. Install dependencies
npm install
cd backend && npm install && cd ..

# 3. Start MongoDB
net start MongoDB  # Windows
# sudo service mongod start  # Linux/Mac

# 4. Start backend
cd backend && npm start

# 5. Start frontend (new terminal)
npm run dev:frontend

# 6. Open browser
http://localhost:5000
```

---

## 📖 What is Rural Gold Connect?

A **peer-to-peer lending platform** connecting borrowers (farmers, small businesses) directly with lenders (investors) - no banks needed!

### Key Innovation

**DigiLocker + Biometric Security System**

**During Signup:**

1. ✅ DigiLocker validates Aadhaar number (Verhoeff algorithm + government database)
2. ✅ Face captured and stored as 128-D embedding
3. ✅ Aadhaar document converted to SHA-256 hash
4. ✅ OCR extracts and matches name/Aadhaar from uploaded image
5. ✅ OTP sent for two-factor authentication

**During Loan:**

- 🔐 Live face photo compared with stored embedding
- 🛡️ Multiple security layers prevent fraud

---

## 🔐 Security Features

### 1. DigiLocker Integration

**Government Aadhaar Verification**

```javascript
// Automatic mode detection
if (Real API Keys Present) {
  → Contact DigiLocker government API
  → Verify Aadhaar authenticity
  → Match name with official records
} else {
  → Simulation mode (development/testing)
  → Verhoeff algorithm validation (12-digit + checksum)
  → Format validation only
}
```

**Features:**

- ✅ Verhoeff algorithm (mathematical checksum)
- ✅ Government database verification (production)
- ✅ Simulation mode for testing
- ✅ Timestamp-based verification records

---

### 2. OCR Name & Aadhaar Matching 🆕

**Prevents Stolen Document Fraud!**

Uses **Tesseract.js** to extract text from uploaded Aadhaar card and verify it matches form input.

**How it works:**

```
User Form:
- Name: "Sai Krishna S"
- Aadhaar: "647774509944"

OCR Extraction from Image:
- Extracted Name: "SAI KRISHNA S"
- Extracted Aadhaar: "647774509944"

Verification:
✅ Name Match (case-insensitive, fuzzy)
✅ Aadhaar Match (exact)
→ APPROVED

Fraud Attempt:
Form: Name = "Fake User", Aadhaar = "111111111111"
OCR:  Name = "Real Owner", Aadhaar = "647774509944"
❌ Mismatch Detected → REJECTED!
```

**Benefits:**

- 🛡️ Detects stolen Aadhaar cards
- 🛡️ Prevents identity fraud
- 🛡️ Cross-validates entered vs uploaded data

---

### 3. CNN Face Recognition

**TensorFlow.js Neural Network**

- Extracts 128-dimensional face embedding
- Deterministic (same face = same vector)
- 60% similarity threshold
- Real-time processing

**Technology:** Convolutional Neural Networks (CNN)

---

### 4. SHA-256 Document Hashing

**Cryptographic Security**

- Creates unique fingerprint of Aadhaar image
- Detects any tampering (even 1-pixel change)
- 256-bit security standard
- Hash stored in database

---

### 5. Liveness Detection

**Anti-Spoofing Measures**

- Resolution checks (min 200x200)
- Variance analysis (detects printed photos)
- Aspect ratio validation
- Natural detail detection

---

### 6. Two-Factor Authentication

- OTP via Twilio SMS
- 6-digit random code
- Time-limited validity

---

## 🛠️ Technology Stack

### Frontend

```
React 18.x          - UI framework
TypeScript          - Type safety
Vite                - Build tool
Tailwind CSS        - Styling
Shadcn/ui           - Components
```

### Backend

```
Node.js 18.x        - Runtime
Express 4.x         - Web framework
MongoDB 6.x         - Database
JWT                 - Authentication
Multer              - File uploads
```

### Biometric & ML

```
TensorFlow.js 4.x   - CNN face recognition
Tesseract.js 5.x    - OCR engine
Sharp               - Image processing
Crypto (Node.js)    - SHA-256 hashing
Twilio              - SMS/OTP
```

---

## 📥 Installation

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- MongoDB 6+ ([Download](https://www.mongodb.com/try/download/community))
- Git ([Download](https://git-scm.com/))

### Environment Setup

Create `backend/.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/RURALCONNECTQODER

# Authentication
JWT_SECRET=your_secret_key_change_in_production

# Twilio (Optional - for SMS OTP)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# DigiLocker (Optional - for production)
DIGILOCKER_CLIENT_ID=your_digilocker_client_id
DIGILOCKER_CLIENT_SECRET=your_digilocker_secret
DIGILOCKER_REDIRECT_URI=http://localhost:3000/api/auth/digilocker/callback
```

---

## 📱 Usage Guide

### For Borrowers

1. **Sign Up**

   - Fill personal details
   - Choose role: "Borrower"

2. **Verification**

   - Upload face photo
   - Upload Aadhaar card image
   - System performs:
     - DigiLocker validation
     - Face embedding capture
     - OCR name/Aadhaar matching
     - SHA-256 hashing
   - Enter OTP

3. **Request Loan**

   - Amount, duration, purpose
   - AI matches with suitable lender

4. **Receive & Repay**
   - Get loan in bank/UPI
   - Pay monthly EMI

### For Lenders

1. **Sign Up & Verify** (same process)

2. **Browse Requests**

   - See borrower profiles
   - Check credit scores
   - View verification status

3. **Lend Money**
   - Transfer funds
   - Earn interest
   - Track repayments

---

## 🔍 API Endpoints

### Authentication

```http
POST /api/auth/register
POST /api/auth/verify-face
POST /api/auth/verify-otp
POST /api/auth/login
```

### Loans

```http
GET  /api/loans/all
POST /api/loans/request
POST /api/loans/match
PUT  /api/loans/:id/approve
```

### Wallet

```http
GET  /api/wallet/balance
POST /api/wallet/transfer
```

---

## 🔒 Security Workflow

```
User Signs Up
    ↓
DigiLocker Validates Aadhaar
    ↓
Face Captured → CNN Embedding (128-D)
    ↓
Aadhaar Uploaded → SHA-256 Hash
    ↓
OCR Extracts Text → Match Name & Number
    ↓
Liveness Check → Anti-Spoofing
    ↓
OTP Sent → Two-Factor Auth
    ↓
✅ Account Created
    ↓
Later: Loan Application
    ↓
Live Face Photo → Compare with Stored Embedding
    ↓
Similarity > 60% → ✅ Approved
```

---

## 📊 Project Structure

```
rural-gold-connect/
├── backend/
│   ├── models/
│   │   ├── User.js          # User schema with biometric fields
│   │   └── Loan.js          # Loan schema
│   ├── routes/
│   │   ├── auth.js          # Authentication + verification
│   │   ├── loans.js         # Loan management
│   │   └── wallet.js        # Payment handling
│   ├── utils/
│   │   ├── verification.js  # 🌟 Biometric verification (450 lines)
│   │   ├── digilocker.js    # DigiLocker integration
│   │   ├── hashing.js       # SHA-256 implementation
│   │   └── matching.js      # AI loan matching
│   ├── .env                 # Environment variables
│   └── server.js            # Express server
├── src/
│   ├── pages/
│   │   ├── Signup.tsx
│   │   ├── FaceVerification.tsx
│   │   ├── Dashboard.tsx
│   │   └── ...
│   ├── components/          # React components
│   └── lib/                 # Utilities
└── README.md
```

---

## 🎯 Key Features

✅ **DigiLocker Integration** - Government Aadhaar validation  
✅ **OCR Matching** - Prevents stolen document fraud  
✅ **CNN Face Recognition** - 128-D embeddings  
✅ **SHA-256 Hashing** - Document security  
✅ **Liveness Detection** - Anti-spoofing  
✅ **Two-Factor Auth** - OTP verification  
✅ **Simulation Mode** - Works without API keys  
✅ **Production Ready** - Real ML, real security

---

## 🐛 Troubleshooting

**Backend not starting?**

```bash
# Check if MongoDB is running
net start MongoDB

# Check if port 3000 is free
netstat -ano | findstr :3000
```

**Frontend not loading?**

```bash
# Clear cache
rm -rf node_modules
npm install
```

**OCR not working?**

```bash
# Install Tesseract
cd backend
npm install tesseract.js@5.0.4
```

---

## 📞 Contact

**Repository:** https://github.com/SaiKrishna-333/MINIPROJECTNEW  
**Email:** saikrshnas.yadav@gmail.com

---

## 📄 License

MIT License - feel free to use for educational purposes.

---

**Built with ❤️ for rural India**
