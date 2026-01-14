#!/bin/bash

echo "Starting Analytics MVP..."

# Start collector in background
echo "Starting collector on port 3001..."
cd apps/collector
PORT=3001 npx tsx src/server.ts &
COLLECTOR_PID=$!
cd ../..

# Wait a moment for collector to start
sleep 3

# Start web dashboard
echo "Starting web dashboard on port 3000..."
cd apps/web
npx next dev &
WEB_PID=$!
cd ../..

echo ""
echo "Services started!"
echo "  - Collector: http://localhost:3001"
echo "  - Dashboard: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo "PIDs: Collector=$COLLECTOR_PID, Web=$WEB_PID"

# Wait for user interrupt
trap "kill $COLLECTOR_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait


