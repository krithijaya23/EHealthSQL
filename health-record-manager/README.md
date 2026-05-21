# 🏥 Health Record Manager

A full-stack healthcare web application for managing medical records with AI-powered OCR extraction.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, Recharts, React Router |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| OCR/AI | Tesseract.js + pdf-parse |
| File Upload | Multer |

## Features

- **AI + OCR** — Auto-extract doctor name, diagnosis, medicines from uploaded prescriptions
- **Family Profiles** — One account, multiple family member profiles
- **Health Analytics** — Line, bar, and pie charts for visit trends
- **Secure Sharing** — Grant temporary access to doctors with expiry
- **Dark Mode** — Full light/dark theme support
- **Responsive** — Works on all screen sizes

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
npm install
# Edit .env with your MONGO_URI
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/signup | Register |
| POST | /api/auth/login | Login |
| GET | /api/profiles | Get family profiles |
| POST | /api/records/upload | Upload + OCR record |
| GET | /api/records/:profileId | Get records |
| GET | /api/analytics/:profileId | Get analytics |
| GET | /api/summary/:profileId | AI health summary |
| POST | /api/access/share | Share access |

## Environment Variables

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/health_record_manager
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
```
