#!/bin/bash

# Start Clawmander in TEST MODE with sample data
# This script starts both backend and frontend with test mode enabled

echo "🧪 Starting Clawmander in TEST MODE..."
echo ""

# Set test mode
export TEST_MODE=true

# Start backend in background
echo "Starting backend (port 3001) with test data..."
cd "$(dirname "$0")/backend"
TEST_MODE=true node server.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend in background
echo "Starting frontend (port 3000)..."
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Clawmander TEST MODE started!"
echo ""
echo "Backend:  http://localhost:3001 (PID: $BACKEND_PID)"
echo "Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "Test data includes:"
echo "  • 4 sample agents (WhatsApp, Telegram, Discord, Job Search)"
echo "  • 6 sample tasks"
echo "  • Sample budget, work, and job data"
echo ""
echo "To stop: kill $BACKEND_PID $FRONTEND_PID"
echo "Or use: pkill -f 'node server.js' && pkill -f 'next dev'"
echo ""

# Wait for user interrupt
wait
