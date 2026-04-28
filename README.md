# Christian & Faith Stremio Addon

Auto-updating Stremio-compatible catalog of Christian and faith-based movies and shows.
Pulls live data from TMDB so new releases appear automatically.

## Setup (5 minutes)

### 1. Get a free TMDB API key
- Go to https://www.themoviedb.org/settings/api
- Sign up (free) and create an API key (v3 auth)

### 2. Deploy to Render (free hosting)
1. Push this folder to a GitHub repo
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set environment variable: `TMDB_API_KEY=your_key_here`
5. Start command: `node index.js`
6. Copy your Render URL (e.g. https://your-app.onrender.com)

### 3. Deploy to Railway (alternative)
1. Go to https://railway.app → New Project → Deploy from GitHub
2. Add env var: `TMDB_API_KEY=your_key_here`
3. Copy the generated URL

### 4. Add to AioMetadata
1. Open AioMetadata → Custom Manifest Integration
2. Paste: `https://your-app.onrender.com/manifest.json`
3. Click Load Manifest
4. Select all 3 catalogs → Import Selected Catalogs
5. Done!

## Catalogs included
- **Christian Movies** — All Christian/faith-based movies, sorted by popularity
- **Christian Shows** — Faith-based TV series and miniseries
- **New Christian Releases** — Movies from the last 6 months, auto-updating

## How auto-update works
Every time AioMetadata requests the catalog (based on your Cache TTL setting),
the addon fetches fresh data from TMDB. New movies and shows appear automatically
as soon as TMDB indexes them — no manual updates needed.
