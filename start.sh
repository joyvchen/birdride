#!/bin/bash

# BirdRide - Local Development Server
# This script starts a simple web server to run the app locally

echo ""
echo "  🐦 BirdRide - Starting local server..."
echo ""

# Check for Python
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null; then
    PYTHON=python
else
    echo "  ❌ Error: Python is required but not installed."
    echo "     Install Python 3 from https://python.org"
    exit 1
fi

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Start server
PORT=8080
echo "  ✓ Server starting on http://localhost:$PORT"
echo "  ✓ Open this URL in your web browser"
echo ""
echo "  Press Ctrl+C to stop the server"
echo ""

$PYTHON -m http.server $PORT
