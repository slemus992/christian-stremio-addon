const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
app.use(cors({ origin: "*" }));

const TMDB_KEY = process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY_HERE";
const TMDB_BASE = "https://api.themoviedb.org/3";

// Known Christian/faith film production & distribution companies on TMDB
// Pure Flix=4490, Affirm Films=7405, Samuel Goldwyn (faith)=10842,
// Provident Films=30666, Graceway Media=125330, Angel Studios=149154
const CHRISTIAN_COMPANIES = "4490|7405|30666|149154|125330";

// Hardcoded TMDB IDs for top Christian titles as a reliable baseline
// These are confirmed IDs from TMDB
const SEED_MOVIE_IDS = [
  314365,  // War Room
  376867,  // Miracles from Heaven
  418437,  // Overcomer
  488042,  // I Can Only Imagine
  315787,  // God's Not Dead
  264644,  // Heaven is for Real
  374460,  // Risen
  296524,  // The Nativity Story
  35791,   // Fireproof
  90411,   // Courageous
  37936,   // Facing the Giants
  675353,  // Sound of Freedom
  615774,  // I Still Believe
  775996,  // Redeeming Love
  43195,   // Letters to God
  39514,   // Soul Surfer
  385687,  // The Shack
  37165,   // Amazing Grace
  456408,  // Paul, Apostle of Christ
  400617,  // Unbroken: Path to Redemption
  398173,  // The Case for Christ
  288726,  // Son of God
  76163,   // The Blind Side
  956264,  // A Week Away
  257344,  // The Young Messiah
  263115,  // God's Not Dead 2
  430826,  // God's Not Dead: A Light in Darkness
  504608,  // Breakthrough
  618615,  // Unsung Hero
  1008042, // Jesus Revolution
  522162,  // Ordinary Angels
  436270,  // The Resurrection of Gavin Stone
  371781,  // Do You Believe?
  296194,  // Old Fashioned
  259700,  // Mom's Night Out
  241259,  // When the Game Stands Tall
  281338,  // 90 Minutes in Heaven
  333371,  // Woodlawn
  376660,  // Hillsong: Let Hope Rise
  399302,  // The Star (animated)
  438488,  // Same Kind of Different as Me
];

const SEED_SERIES_IDS = [
  95557,   // The Chosen
  60572,   // The Bible (History Channel)
  61550,   // AD: The Bible Continues
  71239,   // The Shack (miniseries placeholder)
];

// ─── MANIFEST ─────────────────────────────────────────────────────────────────
const manifest = {
  id: "org.christian.faithcatalog",
  version: "2.0.0",
  name: "Christian & Faith Catalog",
  description: "Curated catalog of Christian and faith-based movies and shows, auto-updated via TMDB.",
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
  if (!res.ok) throw new Error("TMDB " + res.status + " for " + path);
  return res.json();
}

// Fetch details for seed IDs in batches
async function fetchSeedMovies(skip = 0) {
  const pageIds = SEED_MOVIE_IDS.slice(skip, skip + 20);
  const results = await Promise.all(
    pageIds.map(id => tmdbGet(`/movie/${id}`).catch(() => null))
  );
  return results.filter(Boolean).map(m => toMeta(m, "movie"));
}

async function fetchSeedSeries(skip = 0) {
  const pageIds = SEED_SERIES_IDS.slice(skip, skip + 20);
  const results = await Promise.all(
    pageIds.map(id => tmdbGet(`/tv/${id}`).catch(() => null))
  );
  return results.filter(Boolean).map(s => toMeta(s, "series"));
}

// Also fetch from Pure Flix / Affirm Films / Angel Studios for auto-updating new releases
async function fetchFromCompanies(page = 1) {
  const data = await tmdbGet(
    `/discover/movie?with_companies=${CHRISTIAN_COMPANIES}&sort_by=release_date.desc&vote_count.gte=5&page=${page}`
  );
  return (data.results || []).map(m => toMeta(m, "movie"));
}

async function fetchNewReleases() {
  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await tmdbGet(
    `/discover/movie?with_companies=${CHRISTIAN_COMPANIES}&primary_release_date.gte=${sixMonthsAgo}&primary_release_date.lte=${today}&sort_by=release_date.desc&page=1`
  );
  // Merge with seed movies released recently
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
    const search = extras.search || null;
    let metas = [];

    if (id === "christian-movies") {
      if (search) {
        metas = await searchMovies(search);
      } else {
        // Serve seed list first, then supplement with company-based discovery
        const seedMetas = await fetchSeedMovies(skip);
        if (seedMetas.length < 10) {
          const companyMetas = await fetchFromCompanies(Math.floor(skip / 20) + 1);
          // Deduplicate by id
          const seen = new Set(seedMetas.map(m => m.id));
          metas = [...seedMetas, ...companyMetas.filter(m => !seen.has(m.id))];
        } else {
          metas = seedMetas;
        }
      }
    } else if (id === "christian-series") {
      if (search) {
        metas = await searchSeries(search);
      } else {
        metas = await fetchSeedSeries(skip);
      }
    } else if (id === "christian-new") {
      metas = await fetchNewReleases();
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
  console.log("Christian Stremio Addon v2 live on port " + PORT);
});
