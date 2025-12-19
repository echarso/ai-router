# Price Runner Web App

A full-stack web application for displaying LLM model pricing information with real-time updates.

## Architecture

- **Frontend**: React with Vite
- **Backend**: Node.js with Express
- **Data Source**: CSV file (designed to be easily replaced with a database)

## Features

- 📊 Real-time model pricing table
- 🔄 Auto-refreshing data (polls backend every 5 seconds)
- 🎨 Modern, responsive UI
- 🔍 Filter by provider
- 📈 Visual MMLU score indicators
- 🏷️ Color-coded provider badges

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

- `GET /api/models` - Get all models
- `GET /api/models/provider/:provider` - Get models by provider
- `GET /api/providers` - Get list of all providers
- `GET /health` - Health check endpoint

## Future Database Integration

The backend is designed with an abstraction layer (`dataService.js`) that makes it easy to switch from CSV to a database. To integrate a database:

1. Modify `dataService.js` to add a `_readFromDatabase()` method
2. Update `getAllModels()` to use the database method instead of `_readFromDatabase()`
3. The API endpoints will continue to work without any changes

## Project Structure

```
pricer-runner-web-app/
├── backend/
│   ├── server.js          # Express server
│   ├── dataService.js     # Data abstraction layer
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main app component
│   │   ├── components/
│   │   │   └── ModelTable.jsx
│   │   └── main.jsx
│   └── package.json
└── README.md
```

