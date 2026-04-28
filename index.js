const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
app.use(cors());

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Get a free TMDB API key at https://www.themoviedb.org/settings/api
const TMDB_KEY = process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY_HERE";
const TMDB_BASE = "https://api.themoviedb.org/3";

// TMDB keyword IDs for Christian/faith content
// 9673 = christian, 10714 = religion, 187056 = faith, 207317 = biblical
const CHRISTIAN_KEYWORDS = "9673,10714,187056,207317";

// Genres to optionally mix in: 18=Drama, 10751=Family, 10402=Music, 99=Documentary
const FAMILY_GENRES = "18,10751,10402,99";

// ─── MANIFEST ─────────────────────────────────────────────────────────────────
const MANIFEST = {
  id: "community.christian.catalog",
  version: "1.0.0",
  name: "Christian & Faith Catalog",
  description:
    "Auto-updating catalog of Christian and faith-based movies and shows. New releases added automatically via TMDB.",
  logo: "https://i.imgur.com/christian-cross-placeholder.png",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "christian_movies",
      name: "Christian Movies",
      extra: [{ name: "skip" }, { name: "search" }],
    },
    {
      type: "series",
      id: "christian_series",
      name: "Christian Shows",
      extra: [{ name: "skip" }, { name: "search" }],
    },
    {
      type: "movie",
      id: "christian_movies_new",
      name: "New Christian Releases",
      extra: [{ name: "skip" }],
    },
  ],
  behaviorHints: {
    adult: false,
    p2pMediaServerSide: false,
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toStremioMeta(item, type) {
  const isMovie = type === "movie";
  return {
    id: `tmdb:${item.id}`,
    type: isMovie ? "movie" : "series",
    name: item.title || item.name,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
    background: item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : null,
    description: item.overview || "",
    releaseInfo: (item.release_date || item.first_air_date || "").slice(0, 4),
    imdbRating: item.vote_average ? item.vote_average.toFixed(1) : null,
    genres: [],
  };
}

async function fetchChristianMovies(page = 1, search = null) {
  if (search) {
    const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(search)}&language=en-US&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    return (data.results || []).map((m) => toStremioMeta(m, "movie"));
  }

  const url =
    `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}` +
    `&with_keywords=${CHRISTIAN_KEYWORDS}` +
    `&language=en-US` +
    `&sort_by=popularity.desc` +
    `&page=${page}` +
    `&vote_count.gte=10`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.results || []).map((m) => toStremioMeta(m, "movie"));
}

async function fetchChristianSeries(page = 1, search = null) {
  if (search) {
    const url = `${TMDB_BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(search)}&language=en-US&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    return (data.results || []).map((s) => toStremioMeta(s, "series"));
  }

  const url =
    `${TMDB_BASE}/discover/tv?api_key=${TMDB_KEY}` +
    `&with_keywords=${CHRISTIAN_KEYWORDS}` +
    `&language=en-US` +
    `&sort_by=popularity.desc` +
    `&page=${page}` +
    `&vote_count.gte=5`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.results || []).map((s) => toStremioMeta(s, "series"));
}

async function fetchNewReleases() {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(today.getMonth() - 6);
  const fromDate = sixMonthsAgo.toISOString().slice(0, 10);
  const toDate = today.toISOString().slice(0, 10);

  const url =
    `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}` +
    `&with_keywords=${CHRISTIAN_KEYWORDS}` +
    `&primary_release_date.gte=${fromDate}` +
    `&primary_release_date.lte=${toDate}` +
    `&language=en-US` +
    `&sort_by=release_date.desc` +
    `&page=1`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.results || []).map((m) => toStremioMeta(m, "movie"));
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.get("/manifest.json", (req, res) => {
  res.json(MANIFEST);
});

// Catalog endpoint: /catalog/:type/:id.json or /catalog/:type/:id/skip=N.json
app.get("/catalog/:type/:id/:extras?.json", async (req, res) => {
  try {
    const { type, id } = req.params;
    const extrasStr = req.params.extras || "";

    // Parse extras (e.g. "skip=20" or "search=Jesus")
    const extras = {};
    extrasStr.split("&").forEach((part) => {
      const [k, v] = part.split("=");
      if (k && v) extras[k] = decodeURIComponent(v);
    });

    const page = extras.skip ? Math.floor(parseInt(extras.skip) / 20) + 1 : 1;
    const search = extras.search || null;

    let metas = [];

    if (id === "christian_movies") {
      metas = await fetchChristianMovies(page, search);
    } else if (id === "christian_series") {
      metas = await fetchChristianSeries(page, search);
    } else if (id === "christian_movies_new") {
      metas = await fetchNewReleases();
    }

    res.json({ metas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ metas: [], error: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    addon: MANIFEST.name,
    manifest_url: `${req.protocol}://${req.get("host")}/manifest.json`,
  });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Christian Stremio Addon running on port ${PORT}`);
  console.log(`Manifest: http://localhost:${PORT}/manifest.json`);
});
