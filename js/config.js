/**
 * BirdRide - Configuration
 *
 * API Keys and Settings
 *
 * HOW TO GET API KEYS:
 *
 * 1. eBird API (for bird data):
 *    - Go to: https://ebird.org/api/keygen
 *    - Sign in with your eBird account (free to create)
 *    - Request an API key
 *    - Copy the key below
 *
 * 2. RideWithGPS API (for cycling routes):
 *    - Go to: https://ridewithgps.com/api
 *    - Sign up for API access (free tier available)
 *    - You'll get an API key and auth token
 *    - Copy them below
 *
 * IMPORTANT: Never commit this file with real API keys!
 * Add config.js to .gitignore if you add real keys.
 */

export const config = {
    // eBird API - Get your key at https://ebird.org/api/keygen
    ebird: {
        apiKey: 'dbvvrg1t1p62', // Your eBird API key
        baseUrl: 'https://api.ebird.org/v2',
    },

    // Macaulay Library API (for bird photos - no key required)
    macaulayLibrary: {
        baseUrl: 'https://search.macaulaylibrary.org/api/v1',
    },

    // RideWithGPS API - Get access at https://ridewithgps.com/api
    rideWithGPS: {
        apiKey: '', // Paste your RideWithGPS API key here
        authToken: '', // Paste your auth token here
        baseUrl: 'https://ridewithgps.com',
    },

    // CORS Proxy for cross-origin requests
    corsProxy: 'https://corsproxy.io/?',

    // App settings
    app: {
        // Use mock data if API keys aren't configured
        useMockData: false, // Using real eBird data

        // Default search radius for bird sightings (in kilometers)
        searchRadiusKm: 2.5,

        // Maximum points to sample along a route for bird queries
        maxSamplePoints: 15,

        // Number of popular routes to show
        popularRoutesLimit: 10,

        // Default time window for recent sightings (days)
        defaultTimeWindow: 14,
    },
};

/**
 * Check if real API keys are configured
 */
export function hasEBirdKey() {
    return config.ebird.apiKey && config.ebird.apiKey.length > 0;
}

export function hasRideWithGPSKey() {
    return config.rideWithGPS.apiKey && config.rideWithGPS.apiKey.length > 0;
}

export function shouldUseMockData() {
    return config.app.useMockData || (!hasEBirdKey() && !hasRideWithGPSKey());
}
