# BirdRide Setup Guide

This guide will help you run BirdRide locally and connect it to real data sources.

---

## Quick Start (Demo Mode)

The app works immediately with sample data - no setup needed!

1. Open Terminal
2. Go to the project folder:
   ```
   cd ~/birdride
   ```
3. Start the local server:
   ```
   ./start.sh
   ```
4. Open your browser to: **http://localhost:8080**

You'll see demo bird data when you select a route.

---

## Connecting Real Data

To see actual bird sightings, you'll need a free eBird API key.

### Step 1: Get an eBird API Key (Free)

1. Go to **https://ebird.org/api/keygen**
2. If you don't have an eBird account, create one (free)
3. Log in and request an API key
4. Copy the key (looks like: `abc123def456...`)

### Step 2: Add Your API Key

1. Open the file `js/config.js` in a text editor
2. Find this line:
   ```javascript
   apiKey: '', // Paste your eBird API key here
   ```
3. Paste your key between the quotes:
   ```javascript
   apiKey: 'your-key-here',
   ```
4. Change this line from `true` to `false`:
   ```javascript
   useMockData: false,
   ```
5. Save the file

### Step 3: Restart and Test

1. Refresh the browser (or restart the server)
2. Search for a location and pick a route
3. You should now see real bird sightings!

---

## Pushing to GitHub

Since the GitHub CLI (`gh`) isn't installed, here's how to push manually:

### Option A: Create repo on GitHub website

1. Go to **https://github.com/new**
2. Name it `birdride` (or whatever you prefer)
3. Keep it Public or Private (your choice)
4. **Don't** check "Add README" (we already have files)
5. Click "Create repository"
6. GitHub will show you commands - use the "push an existing repository" ones:
   ```
   cd ~/birdride
   git remote add origin https://github.com/YOUR-USERNAME/birdride.git
   git branch -M main
   git push -u origin main
   ```

### Option B: Install GitHub CLI (recommended for future use)

1. Install Homebrew (if not installed):
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Install GitHub CLI:
   ```
   brew install gh
   ```
3. Log in:
   ```
   gh auth login
   ```
4. Create and push repo:
   ```
   cd ~/birdride
   gh repo create birdride --public --source=. --push
   ```

---

## Hosting Your App Online

Once it's on GitHub, you can host it free on GitHub Pages:

1. Go to your repo on GitHub
2. Click **Settings** → **Pages** (in left sidebar)
3. Under "Source", select **main** branch
4. Click **Save**
5. Your app will be live at: `https://YOUR-USERNAME.github.io/birdride`

---

## About the APIs

### eBird (Bird Data)
- **Website**: https://ebird.org
- **API Docs**: https://documenter.getpostman.com/view/664302/S1ENwy59
- **Cost**: Free
- **What it provides**: Recent bird sightings, species info, locations

### RideWithGPS (Route Data)
- **Website**: https://ridewithgps.com
- **API Docs**: https://ridewithgps.com/api
- **Cost**: Free tier available
- **What it provides**: Cycling routes, distances, elevation

Currently, the app uses sample route data. Full RideWithGPS integration would require:
1. Apply for API access at ridewithgps.com/api
2. Add your credentials to `js/config.js`
3. Update `js/services/routeService.js` to make real API calls

---

## Troubleshooting

**"Port 8080 already in use"**
- Another app is using that port
- Edit `start.sh` and change `PORT=8080` to `PORT=8081` (or another number)

**Birds not showing on map**
- Check browser console (F12 → Console tab) for errors
- Verify your API key is correct in `config.js`
- Make sure `useMockData` is set to `false`

**Location search not working**
- The app uses OpenStreetMap which is sometimes slow
- Try searching for major cities first (Seattle, Portland, etc.)

---

## Project Structure

```
birdride/
├── index.html          # Main webpage
├── start.sh            # Script to run locally
├── SETUP.md            # This file
├── css/
│   └── styles.css      # All styling
└── js/
    ├── app.js          # Main application
    ├── config.js       # API keys go here
    ├── components/     # UI pieces
    │   ├── UnifiedInput.js   # Search box
    │   ├── MapView.js        # Map display
    │   ├── BirdList.js       # Bird sidebar
    │   ├── BirdDetail.js     # Bird info panel
    │   └── FilterControls.js # Filters
    ├── services/       # Data fetching
    │   ├── birdService.js      # eBird integration
    │   ├── routeService.js     # Route handling
    │   └── geocodingService.js # Location search
    └── utils/
        └── state.js    # App state management
```
