# Smart Wage Worker - Architecture Documentation

![System Architecture](./architecture.svg)

## System Overview

The **Smart Wage Worker** application is an accessibility-first, full-stack web platform built for daily-wage workers and employers. The architecture consists of three primary layers:

1. **Frontend Presentation & Accessibility Layer**: Built with React 19 + Vite, featuring voice assistant integration (Web Speech API + SpeechSynthesis TTS), multi-language i18n (English, Telugu, Hindi), Leaflet interactive maps, and HTML5 QR Scanning.
2. **Backend API Server**: Node.js + Express REST API supporting real-time geofence tracking, trust score calculations, authentication, and job management.
3. **Database & Cloud Services**: Firebase Authentication (with mock OTP dev fallback), Cloud Firestore, Firebase Storage, and Admin SDK integration.

---

## 🏗️ Architectural Component Diagram

```mermaid
graph TD
    subgraph Frontend Client Layer (React 19 + Vite)
        UI[React Single Page App]
        Voice[Voice Assistant Context]
        Geo[Geo-Tracking & Leaflet Maps]
        QR[HTML5 QR Scanner]
    end

    subgraph Express Backend API (Node.js)
        Server[Express Server (Port 5000)]
        AuthMid[Auth Middleware (Bearer Token)]
        Routes[API Routes: /auth, /jobs, /geofence, /stats]
        GeoLogic[Haversine GeoFence Engine]
    end

    subgraph Firebase Cloud Layer
        FBAuth[Firebase Phone Auth / Mock Fallback]
        Firestore[(Cloud Firestore NoSQL)]
        AdminSDK[Firebase Admin SDK]
    end

    UI -->|HTTP / REST| Server
    Voice -->|TTS & Speech Recognition| UI
    Geo -->|Coordinates| GeoLogic
    QR -->|Attendance Verification| Server

    Server --> AuthMid
    AuthMid --> Routes
    Routes --> AdminSDK
    AdminSDK --> Firestore
    FBAuth --> AuthMid
```

---

## 📁 Layer Breakdown

### 1. Presentation & Accessibility Layer (`src/`)
- **`src/contexts/VoiceContext.jsx`**: Global voice navigation and speech synthesis handling for Telugu, Hindi, and English commands.
- **`src/hooks/useGeoTracking.js`**: Custom React hook for live geolocation monitoring and proximity alerts.
- **`src/components/TrackingMap.jsx`**: Interactive Leaflet map displaying worker live position and job geofence radius.
- **`src/components/QRScanner.jsx`**: Camera QR code reader for instant attendance recording.
- **`src/pages/WorkerDashboard.jsx` & `EmployerDashboard.jsx`**: Tailored user interfaces for job management and trust tracking.

### 2. Express Backend API (`backend/`)
- **`backend/server.js`**: Main entry point listening on `http://localhost:5000`.
- **`backend/middleware/auth.js`**: Middleware for verifying Bearer tokens and session identity.
- **`backend/controllers/`**: Business logic controllers for Auth, Jobs, Attendance, GeoFencing, Stats, and Reviews.
- **`backend/utils/geoValidator.js`**: Haversine distance calculations and boundary check validators.

### 3. Database & Authentication (`src/firebase.js` & `backend/config/firebaseAdmin.js`)
- **Cloud Firestore**: Collections for `users`, `jobs`, `applications`, `attendance`, `geofence_logs`, and `reviews`.
- **Resilient Mock Fallback**: Automatic mock OTP fallback (`123456`) when operating in offline or unconfigured Firebase environments.

---

## 🔒 Security & Data Flow
- All write actions require authenticated requests via `Bearer` tokens.
- Firestore Security Rules enforce document access controls for workers and employers.
