# AI Meeting Analyzer - Flask and React Integration

This document provides instructions for running the AI Meeting Analyzer application with the integrated Flask backend for data analysis.

## Architecture Overview

The application consists of three main components:

1. **Flask API** - Python-based analysis backend that processes meeting data
2. **Node.js Server** - Main application backend that handles auth, database, and serves as a gateway to the Flask API
3. **React Dashboard** - Frontend that displays meeting data and analysis

## Setup Instructions

### 1. Start the Flask API

Navigate to the Flask application directory and start the server:

```bash
cd analysis/flask_app
python app.py
```

The Flask API will start on http://localhost:6000

### 2. Start the Node.js Backend

Navigate to the dashboard directory and start the Node.js server:

```bash
cd dashboard
npm run dev
```

The Node.js backend will start on http://localhost:3000

### 3. Start the React Frontend

In a new terminal, navigate to the dashboard directory and start the Vite development server:

```bash
cd dashboard
cd client
npm run dev
```

The React frontend will start on http://localhost:5173

## Testing the Integration

To test if the Flask API integration is working correctly:

```bash
cd dashboard
npm run test:flask
```

This script tests the direct connections to the Flask API and the proxied connections through the Node.js backend.

## Workflow

1. Start all three services (Flask, Node.js, React)
2. Open the React dashboard in a browser (http://localhost:5173)
3. Navigate to the Reports page
4. Select a meeting from the dropdown
5. The dashboard will load data from the Node.js backend, which in turn fetches and transforms data from the Flask API

## Troubleshooting

If you encounter issues with the integration:

1. Check that the Flask API is running and accessible (http://localhost:6000)
2. Ensure CORS is properly configured in the Flask app
3. Check the browser console for any API errors
4. Run the test script to verify connections
5. Check the terminal outputs for each service for error messages

## API Endpoints

### Flask API Endpoints

- `/api/sentiment_transition/:meetingId` - Get sentiment analysis for meeting transitions
- `/api/agenda_drift/:meetingId` - Get agenda drift analysis
- `/api/speaker_contribution/:meetingId` - Get speaker contribution analysis

### Node.js Backend Endpoints

- `/api/reports/sentiment/:meetingId` - Get transformed sentiment data
- `/api/reports/topics/:meetingId` - Get transformed topic drift data
- `/api/reports/transitions/:meetingId` - Get transformed meeting transitions data
- `/api/reports/speaker_contribution/:meetingId` - Get transformed speaker contribution data
