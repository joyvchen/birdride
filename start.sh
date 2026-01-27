#!/bin/bash

# BirdRide - Start Server
# This script installs dependencies and starts the Node.js server

echo ""
echo "  BirdRide - Starting server..."
echo ""

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "  Error: Node.js is required but not installed."
    echo "  Install Node.js from https://nodejs.org"
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "  Error: npm is required but not installed."
    echo "  Install Node.js from https://nodejs.org (npm is included)"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install
    echo ""
fi

# Start the server
node server.js
