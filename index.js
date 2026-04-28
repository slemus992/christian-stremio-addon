const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
app.use(cors({ origin: "*" }));

const TMDB_KEY = process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY_HERE";
const TMDB_BASE = "https://api.themoviedb.org/3";

// Verified Christian studio company IDs from TMDB
// 165435 = Angel Studios, 7405 = Affirm Films, 4490 = Pure Flix Entertainment
// 30666 = Provident Films, 125330 = Graceway Media, 149154 = Fathom Events (faith)
// Using pipe | = OR so any movie from ANY of these companies shows up
const COMPANIES = "165435|7405|4490|30666|125330";

// ─── MANIFEST ─────────────────────────────────────────────────────────────────
const manifest = {
  id: "org.christian.faithcatalog",
  version: "3.0.0",
  name: "Christian & Faith Catalog",
  description: "Auto-updating Christian and faith-based movies and shows. Powered by Pure Flix, Affirm Films, Angel Studios & more.",
  resources: ["catalog"],
  types: ["movie", "series"],
  idPrefixes: ["tmdb:"],
  catalogs: [
    {
      id: "christian-movies",
      type: "movie",
      name: "Christian Movies",
      extra: [{ name: "skip", isRequired: false }, { name: "search", isRequired: false }]
    },
    {
      id: "christian-series",
      type: "series",
      name: "Christian Shows",
      extra: [{ name: "skip", isRequired: false }, { name: "search", isRequired: false }]
    },
    {
      id: "christian-new",
      type: "movie",
      name: "New Christian Releases",
      extra: [{ name: "skip", isRequired: false }]
    }
  ]
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toMeta(item, type) {
  return {
    id: "tmdb:" + item.id,
    type,
    name: item.title || item.name || "Unknown",
    poster: item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : undefined,
    background: item.backdrop_path ? "https://image.tmdb.org/t/p/original" + item.backdrop_path : undefined,
    description: item.overview || "",
    releaseInfo: (item.release_date || item.first_air_date || "").slice(0, 4),
    imdbRating: item.vote_average ? String(item.vote_average.toFixed(1)) : undefined
  };
}

async function tmdbGet(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TMDB_BASE}${path}${sep}api_key=${TMDB_KEY}&language=en-US`);
  if (!res.ok) throw new Error("TMDB " + res.status);
  return res.json();
}

// All movies from Christian studios, sorted by popularity, paginated
async function getMovies(page) {
  const data = await tmdbGet(
    `/discover/movie?with_companies=${COMPANIES}&sort_by=popularity.desc&page=${page}`
  );
  return (data.results || []).map(m => toMeta(m, "movie"));
}

// All series from Christian studios
async function getSeries(page) {
  const data = await tmdbGet(
    `/discover/tv?with_companies=${COMPANIES}&sort_by=popularity.desc&page=${page}`
  );
  return (data.results || []).map(s => toMeta(s, "series"));
}

// New releases in the last 6 months from Christian studios — auto-updates daily
async function getNewReleases() {
  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await tmdbGet(
    `/discover/movie?with_companies=${COMPANIES}&primary_release_date.gte=${sixMonthsAgo}&primary_release_date.lte=${today}&sort_by=release_date.desc&page=1`
  );
  return (data.results || []).map(m => toMeta(m, "movie"));
}

async function searchMovies(query) {
  const data = await tmdbGet(`/search/movie?query=${encodeURIComponent(query)}&page=1`);
  return (data.results || []).map(m => toMeta(m, "movie"));
}

async function searchSeries(query) {
  const data = await tmdbGet(`/search/tv?query=${encodeURIComponent(query)}&page=1`);
  return (data.results || []).map(s => toMeta(s, "series"));
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.get(["/manifest.json", "/manifest"], (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(manifest);
});

app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  try {
    const { type, id } = req.params;
    const extraStr = req.params.extra || "";

    const extras = {};
    extraStr.split("&").forEach(part => {
      const eq = part.indexOf("=");
      if (eq > -1) extras[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
    });

    const skip = parseInt(extras.skip || "0", 10);
    const page = Math.floor(skip / 20) + 1;
    const search = extras.search || null;
    let metas = [];

    if (id === "christian-movies") {
      metas = search ? await searchMovies(search) : await getMovies(page);
    } else if (id === "christian-series") {
      metas = search ? await searchSeries(search) : await getSeries(page);
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

app.get("/", (req, res) => {
  const host = req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  res.json({ status: "running", manifest_url: `${proto}://${host}/manifest.json` });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log("Christian Stremio Addon v3 live on port " + PORT);
});
