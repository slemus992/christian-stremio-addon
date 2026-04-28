const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
app.use(cors({ origin: "*" }));

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TMDB_KEY = process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY_HERE";
const TMDB_BASE = "https://api.themoviedb.org/3";
const CHRISTIAN_KEYWORDS = "9673,10714,187056,207317";

// ─── MANIFEST (strict Stremio v4 format) ─────────────────────────────────────
const manifest = {
  id: "org.christian.faithcatalog",
  version: "1.0.0",
  name: "Christian & Faith Catalog",
  description: "Auto-updating catalog of Christian and faith-based movies and shows powered by TMDB.",
  resources: ["catalog"],
  types: ["movie", "series"],
  idPrefixes: ["tmdb:"],
  catalogs: [
    {
      id: "christian-movies",
      type: "movie",
      name: "Christian Movies",
      extra: [
        { name: "skip", isRequired: false },
        { name: "search", isRequired: false }
      ]
    },
    {
      id: "christian-series",
      type: "series",
      name: "Christian Shows",
      extra: [
        { name: "skip", isRequired: false },
        { name: "search", isRequired: false }
      ]
    },
    {
      id: "christian-new",
      type: "movie",
      name: "New Christian Releases",
      extra: [
        { name: "skip", isRequired: false }
      ]
    }
  ]
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toMeta(item, type) {
  return {
    id: "tmdb:" + item.id,
    type: type,
    name: item.title || item.name || "Unknown",
    poster: item.poster_path
      ? "https://image.tmdb.org/t/p/w500" + item.poster_path
      : undefined,
    background: item.backdrop_path
      ? "https://image.tmdb.org/t/p/original" + item.backdrop_path
      : undefined,
    description: item.overview || "",
    releaseInfo: (item.release_date || item.first_air_date || "").slice(0, 4),
    imdbRating: item.vote_average ? String(item.vote_average.toFixed(1)) : undefined
  };
}

async function tmdbFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("TMDB error: " + res.status);
  return res.json();
}

async function getMovies(page, search) {
  let url;
  if (search) {
    url = `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(search)}&language=en-US&page=${page}`;
  } else {
    url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&with_keywords=${CHRISTIAN_KEYWORDS}&language=en-US&sort_by=popularity.desc&vote_count.gte=10&page=${page}`;
  }
  const data = await tmdbFetch(url);
  return (data.results || []).map(m => toMeta(m, "movie"));
}

async function getSeries(page, search) {
  let url;
  if (search) {
    url = `${TMDB_BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(search)}&language=en-US&page=${page}`;
  } else {
    url = `${TMDB_BASE}/discover/tv?api_key=${TMDB_KEY}&with_keywords=${CHRISTIAN_KEYWORDS}&language=en-US&sort_by=popularity.desc&vote_count.gte=5&page=${page}`;
  }
  const data = await tmdbFetch(url);
  return (data.results || []).map(s => toMeta(s, "series"));
}

async function getNewReleases() {
  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&with_keywords=${CHRISTIAN_KEYWORDS}&primary_release_date.gte=${sixMonthsAgo}&primary_release_date.lte=${today}&language=en-US&sort_by=release_date.desc&page=1`;
  const data = await tmdbFetch(url);
  return (data.results || []).map(m => toMeta(m, "movie"));
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Manifest
app.get(["/manifest.json", "/manifest"], (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(manifest);
});

// Catalog route
app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  try {
    const { type, id } = req.params;
    const extraStr = req.params.extra || "";

    const extras = {};
    extraStr.split("&").forEach(part => {
      const eqIdx = part.indexOf("=");
      if (eqIdx > -1) {
        extras[part.slice(0, eqIdx)] = decodeURIComponent(part.slice(eqIdx + 1));
      }
    });

    const skip = parseInt(extras.skip || "0", 10);
    const page = Math.floor(skip / 20) + 1;
    const search = extras.search || null;

    let metas = [];

    if (id === "christian-movies") {
      metas = await getMovies(page, search);
    } else if (id === "christian-series") {
      metas = await getSeries(page, search);
    } else if (id === "christian-new") {
      metas = await getNewReleases();
    }

    res.setHeader("Content-Type", "application/json");
    res.json({ metas });
  } catch (err) {
    console.error("Catalog error:", err.message);
    res.status(500).json({ metas: [], error: err.message });
  }
});

// Root - shows your manifest URL
app.get("/", (req, res) => {
  const host = req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  res.json({
    status: "running",
    paste_this_into_aiometadata: `${proto}://${host}/manifest.json`
  });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log("Christian Stremio Addon live on port " + PORT);
  console.log("Manifest: http://localhost:" + PORT + "/manifest.json");
});
