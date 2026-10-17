/* ===== Rinderbestand – App-Logik =====
 * Wird von index.html über Babel (type="text/babel") geladen.
 */

/* --- Speicher: window.storage -> localStorage --- */
// Ersetzt die Claude-Artefakt-Speicherfunktion (window.storage) durch den
// browsereigenen localStorage, damit die App auch außerhalb von Claude
// dauerhaft speichert (z. B. als eigenständige HTML-Datei).
window.storage = {
  async get(key /*, shared */) {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      throw new Error("Key not found: " + key);
    }
    return { key, value: raw, shared: false };
  },
  async set(key, value /*, shared */) {
    try {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    } catch (e) {
      console.error("storage.set failed", e);
      return null;
    }
  },
  async delete(key /*, shared */) {
    localStorage.removeItem(key);
    return { key, deleted: true, shared: false };
  },
  async list(prefix /*, shared */) {
    const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

/* --- Service Worker (optional, nur bei https/localhost) --- */
// Service Worker fürs Offline-Caching (funktioniert nur, wenn die Seite über
// https oder localhost aufgerufen wird - nicht bei direktem Öffnen als Datei).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  try {
    var swCode = "\n"
      + "const CACHE_NAME = 'rinderbestand-v1';\n"
      + "self.addEventListener('install', (e) => { self.skipWaiting(); });\n"
      + "self.addEventListener('activate', (e) => { self.clients.claim(); });\n"
      + "self.addEventListener('fetch', (event) => {\n"
      + "  event.respondWith(\n"
      + "    caches.open(CACHE_NAME).then((cache) =>\n"
      + "      fetch(event.request)\n"
      + "        .then((response) => {\n"
      + "          if (response && response.status === 200) cache.put(event.request, response.clone());\n"
      + "          return response;\n"
      + "        })\n"
      + "        .catch(() => cache.match(event.request))\n"
      + "    )\n"
      + "  );\n"
      + "});\n";
    var swBlob = new Blob([swCode], { type: 'application/javascript' });
    var swUrl = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swUrl).catch(function () { /* kein Problem, App läuft trotzdem */ });
  } catch (e) { /* Service Worker optional, App funktioniert auch ohne */ }
}

/* --- App --- */
try {
const { useState, useEffect, useMemo, useRef, createContext, useContext } = React;

// Eigenständige SVG-Icons als Ersatz für lucide-react (kein Bundler/npm nötig)
function makeIcon(paths) {
  return function Icon({ size = 24, className = "", style, onClick }) {
    return React.createElement(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className,
        style,
        onClick,
      },
      paths.map((p, i) => React.createElement("path", { key: i, d: p.d, fill: p.fill }))
    );
  };
}

const Plus = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("line", { x1: 12, y1: 5, x2: 12, y2: 19 }),
    React.createElement("line", { x1: 5, y1: 12, x2: 19, y2: 12 })
  );
};

const X = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("path", { d: "M18 6 6 18" }),
    React.createElement("path", { d: "m6 6 12 12" })
  );
};

const ChevronRight = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("path", { d: "m9 18 6-6-6-6" })
  );
};

const Pencil = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }),
    React.createElement("path", { d: "m15 5 4 4" })
  );
};

const Trash2 = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("path", { d: "M3 6h18" }),
    React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }),
    React.createElement("path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
    React.createElement("line", { x1: 10, y1: 11, x2: 10, y2: 17 }),
    React.createElement("line", { x1: 14, y1: 11, x2: 14, y2: 17 })
  );
};

const TagIcon = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("path", { d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" }),
    React.createElement("circle", { cx: 7.5, cy: 7.5, r: 0.5, fill: "currentColor" })
  );
};

const ArrowUpDown = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("path", { d: "m21 16-4 4-4-4" }),
    React.createElement("path", { d: "M17 20V4" }),
    React.createElement("path", { d: "m3 8 4-4 4 4" }),
    React.createElement("path", { d: "M7 4v16" })
  );
};

const MoreVertical = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("circle", { cx: 12, cy: 12, r: 1, fill: "currentColor" }),
    React.createElement("circle", { cx: 12, cy: 5, r: 1, fill: "currentColor" }),
    React.createElement("circle", { cx: 12, cy: 19, r: 1, fill: "currentColor" })
  );
};

const Settings = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" }),
    React.createElement("circle", { cx: 12, cy: 12, r: 3 })
  );
};

const Cake = function ({ size = 24, className = "", style }) {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className, style },
    React.createElement("path", { d: "M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" }),
    React.createElement("path", { d: "M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" }),
    React.createElement("path", { d: "M2 21h20" }),
    React.createElement("path", { d: "M7 8v3" }),
    React.createElement("path", { d: "M12 8v3" }),
    React.createElement("path", { d: "M17 8v3" }),
    React.createElement("path", { d: "M7 4h.01" }),
    React.createElement("path", { d: "M12 4h.01" }),
    React.createElement("path", { d: "M17 4h.01" })
  );
};




const STORAGE_KEY = "cattle:animals";
const MobileScrollContext = createContext(false);
const AppModeContext = createContext("admin"); // "admin" | "besucher"

const CATEGORIES = ["Mutterkühe", "Kälber", "Jungrinder", "Deckbullen"];

const CATEGORY_SINGULAR = {
  "Mutterkühe": "Mutterkuh",
  "Kälber": "Kalb",
  "Jungrinder": "Jungrind",
  "Deckbullen": "Deckbulle",
};

// Amtlicher Rasseschlüssel für Rinder gemäß Anlage 6 der Viehverkehrsverordnung (ViehVerkV)
const BREEDS = [
  { code: "01", short: "SBT", name: "Holstein-Schwarzbunt" },
  { code: "02", short: "RBT", name: "Holstein-Rotbunt" },
  { code: "03", short: "JER", name: "Jersey" },
  { code: "04", short: "BV", name: "Braunvieh" },
  { code: "05", short: "RVA", name: "Angler" },
  { code: "06", short: "RV", name: "Rotvieh alter Angler Zuchtrichtung" },
  { code: "09", short: "RDN", name: "Doppelnutzung Rotbunt" },
  { code: "10", short: "DSB", name: "Deutsche Schwarzbunte alter Zuchtrichtung" },
  { code: "11", short: "FL", name: "Fleckvieh" },
  { code: "12", short: "GVF", name: "Gelbvieh, Franken Doppelnutzung" },
  { code: "13", short: "PIN", name: "Pinzgauer alter Zuchtrichtung" },
  { code: "14", short: "HIN", name: "Hinterwälder" },
  { code: "15", short: "MW", name: "Murnau-Werdenfelser" },
  { code: "16", short: "VW", name: "Vorderwälder" },
  { code: "17", short: "LMP", name: "Limpurger" },
  { code: "18", short: "DBV", name: "Deutsches Braunvieh alter Zuchtrichtung" },
  { code: "21", short: "CHA", name: "Charolais" },
  { code: "22", short: "LIM", name: "Limousin" },
  { code: "23", short: "WBB", name: "Weißblaue Belgier" },
  { code: "24", short: "BA", name: "Blonde d'Aquitaine" },
  { code: "25", short: "MA", name: "Maine Anjou" },
  { code: "26", short: "SAL", name: "Salers" },
  { code: "27", short: "MON", name: "Montbeliard" },
  { code: "28", short: "AU", name: "Aubrac" },
  { code: "31", short: "PIE", name: "Piemonteser" },
  { code: "32", short: "CHI", name: "Chianina" },
  { code: "33", short: "ROM", name: "Romagnola" },
  { code: "34", short: "MAR", name: "Marchigiana" },
  { code: "41", short: "DA", name: "Deutsche Angus" },
  { code: "42", short: "AA", name: "Aberdeen Angus" },
  { code: "43", short: "HE", name: "Hereford" },
  { code: "44", short: "SH", name: "Deutsches Shorthorn" },
  { code: "45", short: "HLD", name: "Highland" },
  { code: "46", short: "WB", name: "Welsh-Black" },
  { code: "47", short: "GAL", name: "Galloway" },
  { code: "48", short: "LR", name: "Lincoln Red" },
  { code: "49", short: "BGA", name: "Belted Galloway" },
  { code: "50", short: "LG", name: "Luing" },
  { code: "51", short: "BRA", name: "Brangus" },
  { code: "52", short: "NOR", name: "Normanne" },
  { code: "53", short: "UST", name: "Ungarisches Steppenrind" },
  { code: "54", short: "ZEB", name: "Zwerg-Zebus" },
  { code: "55", short: "GRV", name: "Grauvieh" },
  { code: "56", short: "DEX", name: "Dexter" },
  { code: "57", short: "WP", name: "White Park" },
  { code: "58", short: "LH", name: "Longhorn" },
  { code: "59", short: "SD", name: "South Devon" },
  { code: "66", short: "FLF", name: "Fleisch Fleckvieh" },
  { code: "67", short: "UCK", name: "Uckermärker" },
  { code: "68", short: "BLA", name: "Blaarkop" },
  { code: "69", short: "WIT", name: "Witrug" },
  { code: "70", short: "LAK", name: "Lakenfelder" },
  { code: "71", short: "RHV", name: "Rotvieh Zuchtrichtung Höhenvieh" },
  { code: "72", short: "AT", name: "Ansbach-Triesdorfer" },
  { code: "73", short: "GR", name: "Glanrind" },
  { code: "74", short: "PIF", name: "Pinzgauer Fleischnutzung" },
  { code: "75", short: "PS", name: "Pustertaler Schecken" },
  { code: "76", short: "GVF", name: "Gelbvieh Fleischnutzung" },
  { code: "77", short: "BVF", name: "Braunvieh Fleischnutzung" },
  { code: "78", short: "RBF", name: "Rotbunt Fleischnutzung" },
  { code: "79", short: "HWF", name: "Hinterwälder Fleischnutzung" },
  { code: "80", short: "MWF", name: "Murnau-Werdenfelser Fleischnutzung" },
  { code: "81", short: "VWF", name: "Vorderwälder Fleischnutzung" },
  { code: "82", short: "LPF", name: "Limpurger Fleischnutzung" },
  { code: "83", short: "BRA", name: "Brahman" },
  { code: "84", short: "BAZ", name: "Bazadaise" },
  { code: "85", short: "AO", name: "Auerochse" },
  { code: "86", short: "BE", name: "Beefalo" },
  { code: "90", short: "SON", name: "Sonstige Kreuzungen" },
  { code: "97", short: "KRZ", name: "Kreuzung Fleischrind x Fleischrind" },
  { code: "98", short: "KRZ", name: "Kreuzung Fleischrind x Milchrind" },
  { code: "99", short: "KRZ", name: "Kreuzung Milchrind x Milchrind" },
];

const CATEGORY_COLORS = {
  "Mutterkühe": { bg: "#BBDB9A", fg: "#2B2A26" }, // RAL 230-1
  "Kälber": { bg: "#97D9ED", fg: "#2B2A26" }, // RAL 670-2
  "Jungrinder": { bg: "#F78144", fg: "#2B2A26" }, // RAL 380-5
  "Deckbullen": { bg: "#62A293", fg: "#2B2A26" }, // RAL 730-M
  "Abgänge": { bg: "#ADADDD", fg: "#2B2A26" }, // RAL 570-3
  "Unregistriert": { bg: "#C9D3DC", fg: "#2B2A26" }, // grau-blau
  "Samenbank": { bg: "#E0A5CB", fg: "#2B2A26" }, // RAL 510-2
  "Stammbaum": { bg: "#D49964", fg: "#2B2A26" }, // RAL 310-4
  "Ställe": { bg: "#FFFFFF", fg: "#2B2A26" }, // weiß
  "Brunstliste": { bg: "#FFFFFF", fg: "#2B2A26" }, // weiß
};
const FALLBACK_COLOR = { bg: "#5C5A52", fg: "#2B2A26" };

function colorForCategory(cat) {
  return CATEGORY_COLORS[cat] || FALLBACK_COLOR;
}

function fixedGenderFor(cat) {
  if (cat === "Mutterkühe" || cat === "Jungrinder") return "weiblich";
  if (cat === "Deckbullen") return "männlich";
  return null;
}

function genderLabel(g) {
  if (g === "weiblich") return "weiblich";
  if (g === "männlich") return "männlich";
  return "–";
}

function getAgeMonths(birthDate, asOf) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  const now = asOf ? new Date(asOf) : new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) months = 0;
  return months;
}

function formatAgeShort(birthDate, asOf) {
  const months = getAgeMonths(birthDate, asOf);
  if (months === null) return "–";
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${remMonths}M/${years}J`;
}

const COW_TIERS = ["Anfänger", "Fortgeschrittene", "Erfahren", "Experten"];

function tierForCow(animal) {
  const months = getAgeMonths(animal.birthDate);
  if (months === null) return "Anfänger";
  if (months >= 15 * 12) return "Experten";
  if (months >= 10 * 12) return "Erfahren";
  if (months >= 5 * 12) return "Fortgeschrittene";
  return "Anfänger";
}

function groupCowsByTier(cows) {
  const map = {};
  COW_TIERS.forEach((t) => (map[t] = []));
  cows.forEach((c) => {
    map[tierForCow(c)].push(c);
  });
  return map;
}

function cleanEarTag(t) {
  return (t || "").replace(/\s+/g, "").toUpperCase();
}

function sameEarTag(a, b) {
  if (!a || !b) return false;
  return cleanEarTag(a) === cleanEarTag(b);
}

function isValidEarTag(raw) {
  if (!raw) return false;
  const clean = raw.replace(/\s+/g, "");
  return /^[A-Za-z]{2}\d{10}$/.test(clean);
}

function liveFormatEarTag(raw) {
  const clean = raw.replace(/\s+/g, "").toUpperCase().slice(0, 12);
  const parts = [];
  if (clean.length > 0) parts.push(clean.slice(0, 2));
  if (clean.length > 2) parts.push(clean.slice(2, 4));
  if (clean.length > 4) parts.push(clean.slice(4, 7));
  if (clean.length > 7) parts.push(clean.slice(7, 12));
  return parts.join(" ");
}

function formatEarTag(raw) {
  if (!raw) return raw;
  const clean = raw.replace(/\s+/g, "").toUpperCase();
  const m = clean.match(/^([A-Z]{2})(\d{2})(\d{3})(\d{5})$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return raw;
}

function shortEarTag(raw) {
  if (!raw) return raw;
  const clean = cleanEarTag(raw);
  return clean.slice(-5);
}

function formatDate(d) {
  if (!d) return "–";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "–";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function findByEarTag(allAnimals, earTag) {
  if (!earTag) return null;
  return allAnimals.find((a) => sameEarTag(a.earTag, earTag)) || null;
}

function zugehoerigkeit(animal, showOriginal = false) {
  const isAbgang = animal.category === "Abgänge";
  if (isAbgang && !showOriginal) {
    if (animal.abgangsGrund === "verkauft") return "Verkauft";
    if (animal.abgangsGrund === "verendet") return "Verendet";
    return "Abgänge";
  }
  const effectiveCategory = isAbgang && animal.originalCategory ? animal.originalCategory : animal.category;
  const asOf = isAbgang && animal.abgangsDatum ? animal.abgangsDatum : undefined;
  const months = getAgeMonths(animal.birthDate, asOf);
  if (effectiveCategory === "Mutterkühe") return "Mutterkuh";
  if (effectiveCategory === "Deckbullen") return "Deckbulle";
  if (effectiveCategory === "Kälber") {
    if (months === null) return "Kalb";
    return months < 3 ? "Kalb" : "Fresser";
  }
  if (effectiveCategory === "Jungrinder") {
    if (months === null) return "Fresser";
    return months >= 8 ? "Färse" : "Fresser";
  }
  if (isAbgang) return "Tier";
  return animal.category;
}

const PASS_BLUE = "#1E3A5F";

function generateId() {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function EarTagSearchSelect({ value, onChange, options, placeholder, emptyLabel, invalid, allowCreate, onCreate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => sameEarTag(o.earTag, value));
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? options
    : options.filter(
        (o) => o.earTag.toLowerCase().includes(q) || (o.name || "").toLowerCase().includes(q)
      );
  const exactMatch = options.some((o) => o.earTag.toLowerCase() === q);
  const canCreate = allowCreate && query.trim() && !exactMatch;

  return (
    <div className="relative mb-3">
      <input
        value={open ? query : selected ? `${formatEarTag(selected.earTag)}${selected.name ? ` – ${selected.name}` : ""}` : ""}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border bg-white text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
        style={{ borderColor: invalid ? "#B3261E" : "#9CA3AF" }}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[#D9CFB8] bg-white shadow-lg">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="block w-full text-left px-3 py-2 text-sm text-[#8A8672] hover:bg-[#F2EBDD]"
          >
            {emptyLabel}
          </button>
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onCreate(query.trim());
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm font-semibold hover:bg-[#F2EBDD]"
              style={{ color: "#4C6B3F" }}
            >
              „{query.trim()}" als unregistriertes Tier anlegen
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="px-3 py-2 text-sm text-[#B0A98F]">Keine Treffer</p>
          )}
          {filtered.map((o) => (
            <button
              type="button"
              key={o.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.earTag);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm text-[#2B2A26] hover:bg-[#F2EBDD]"
            >
              {formatEarTag(o.earTag)}{o.name ? ` – ${o.name}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RequiredMark({ show }) {
  if (!show) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full ml-1.5 text-[10px] font-bold align-middle"
      style={{ backgroundColor: "#B3261E", color: "#FFFFFF" }}
    >
      !
    </span>
  );
}

function AnimalForm({ initial, initialCategory, initialMotherEarTag, registering, allAnimals, onSave, onCancel, onDelete, onCreateUnregistered }) {
  const [earTag, setEarTag] = useState(initial?.earTag || "");
  const [hasEarTag, setHasEarTag] = useState(initial ? !!initial.earTag : true);
  const [name, setName] = useState(initial?.name || "");
  const [breedCode, setBreedCode] = useState(initial?.breedCode || "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate || "");
  const [category, setCategory] = useState(initial?.category || initialCategory || CATEGORIES[0]);
  const [gender, setGender] = useState(
    initial?.gender || fixedGenderFor(initial?.category || initialCategory || CATEGORIES[0]) || ""
  );
  const [motherEarTag, setMotherEarTag] = useState(initial?.motherEarTag || initialMotherEarTag || "");
  const [fatherEarTag, setFatherEarTag] = useState(initial?.fatherEarTag || "");
  const [merkmale, setMerkmale] = useState(initial?.merkmale || "");
  const [auffaelligkeiten, setAuffaelligkeiten] = useState(initial?.auffaelligkeiten || "");
  const [stall, setStall] = useState(initial?.stall || "");
  const { staelle } = useStaelle();
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isCalf = category === "Kälber";
  const isUnregisteredLightEdit = initial?.category === "Unregistriert" && !registering;
  const todayStr = new Date().toISOString().slice(0, 10);
  const tagPending = isCalf && !hasEarTag;
  const genderFixed = fixedGenderFor(category);
  const showParents = true;
  const mothers = allAnimals.filter(
    (a) => (a.category === "Mutterkühe" || a.category === "Unregistriert") && a.id !== initial?.id
  );
  const fathers = allAnimals.filter(
    (a) => (a.category === "Deckbullen" || a.category === "Unregistriert") && a.id !== initial?.id
  );

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    if (invalidFields.category) setInvalidFields((f) => ({ ...f, category: false }));
    if (cat !== "Kälber") setHasEarTag(true);
    const fg = fixedGenderFor(cat);
    if (fg) setGender(fg);
  };

  const handleSubmit = () => {
    const invalid = {};
    const matchingAnimal =
      !tagPending && earTag.trim()
        ? allAnimals.find((a) => a.id !== initial?.id && sameEarTag(a.earTag, earTag))
        : null;
    // Ein unregistriertes Tier mit derselben Ohrmarke wird beim Neuanlegen übernommen
    // (aufgewertet) statt als Duplikat-Fehler behandelt zu werden.
    const isUnregisteredUpgrade = !initial && matchingAnimal && matchingAnimal.category === "Unregistriert";
    const isDuplicateTag = !tagPending && earTag.trim() && isValidEarTag(earTag) && matchingAnimal && !isUnregisteredUpgrade;

    // Beim normalen Bearbeiten (nicht Registrieren) eines unregistrierten Tieres
    // ist nur die Ohrmarke Pflicht, alle anderen Angaben bleiben optional.

    if (!tagPending && !earTag.trim()) invalid.earTag = true;
    if (!tagPending && earTag.trim() && !isValidEarTag(earTag)) invalid.earTag = true;
    if (isDuplicateTag) invalid.earTag = true;
    if (!isUnregisteredLightEdit) {
      if (!breedCode) invalid.breedCode = true;
      if (!gender) invalid.gender = true;
      if (isCalf && !motherEarTag) invalid.motherEarTag = true;
      if (!birthDate) invalid.birthDate = true;
    }
    if (birthDate && birthDate > todayStr) invalid.birthDate = true;
    const needsCategoryChoice = registering && category === "Unregistriert";
    if (needsCategoryChoice) invalid.category = true;

    if (Object.keys(invalid).length > 0) {
      setInvalidFields(invalid);
      setError(
        birthDate && birthDate > todayStr
          ? "Das Geburtsdatum darf nicht in der Zukunft liegen."
          : isDuplicateTag
          ? "Diese Ohrmarke ist bereits vergeben. Jede Ohrmarke darf nur einmal vorkommen."
          : !tagPending && earTag.trim() && !isValidEarTag(earTag)
          ? "Die Ohrmarke muss im Format DE0836966741 sein (2 Buchstaben + 10 Ziffern, 12 Zeichen)."
          : needsCategoryChoice
          ? "Bitte einen Abschnitt auswählen."
          : "Bitte die rot markierten Pflichtfelder ausfüllen."
      );
      return;
    }
    setInvalidFields({});
    setError("");

    const breedInfo = BREEDS.find((b) => b.code === breedCode);
    onSave({
      id: isUnregisteredUpgrade ? matchingAnimal.id : initial?.id,
      earTag: tagPending ? "" : cleanEarTag(earTag),
      name: name.trim(),
      breed: breedInfo?.name || "",
      breedCode,
      birthDate,
      category,
      gender,
      motherEarTag: showParents ? motherEarTag : "",
      fatherEarTag: showParents ? fatherEarTag : "",
      merkmale: merkmale.trim(),
      auffaelligkeiten: auffaelligkeiten.trim(),
      stall,
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)", paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }} onClick={initial ? undefined : onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-lg">
        {!initial && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-[#F2EBDD] transition"
            aria-label="Schließen"
          >
            <X size={20} className="text-[#2B2A26]" />
          </button>
        )}
        <div
          className="w-full bg-white rounded-t-2xl sm:rounded-2xl border-2 overflow-y-auto"
          style={{ borderColor: PASS_BLUE, maxHeight: "min(90vh, 90dvh)" }}
        >
          <p
            className="font-slab text-3xl font-bold px-4 pt-3 pb-1 text-left rounded-t-2xl sm:rounded-t-2xl"
            style={{ color: PASS_BLUE, backgroundColor: "#CFDBEB" }}
          >
            Rinderpass
          </p>
          <p
            className="text-xs font-semibold uppercase tracking-wide px-4 pb-3"
            style={{ color: PASS_BLUE, backgroundColor: "#CFDBEB" }}
          >
            {initial ? "Bearbeiten" : "Neues Tier"}
          </p>

          <div className="px-5 py-4 rounded-b-2xl" style={{ backgroundColor: "#CFDBEB" }}>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
          Gruppierung
          <RequiredMark show={invalidFields.category} />
        </label>
        {registering ? (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {CATEGORIES.map((cat) => {
              const color = colorForCategory(cat);
              const active = category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className="rounded-lg px-2 py-2 text-sm font-medium border transition"
                  style={
                    active
                      ? { backgroundColor: color.bg, color: color.fg, borderColor: color.bg }
                      : { backgroundColor: "white", color: "#6B6858", borderColor: "#9CA3AF" }
                  }
                >
                  {cat}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-sm font-semibold inline-block"
            style={{ backgroundColor: colorForCategory(category).bg, color: colorForCategory(category).fg }}
          >
            {category}
          </div>
        )}

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
          Ohrmarke{tagPending ? "" : " *"}
          <RequiredMark show={invalidFields.earTag} />
        </label>

        {isCalf && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              type="button"
              onClick={() => setHasEarTag(true)}
              className="rounded-lg px-2 py-2 text-sm font-medium border transition"
              style={{
                backgroundColor: "white",
                color: "#2B2A26",
                borderColor: hasEarTag ? "#2B2A26" : "#9CA3AF",
                opacity: hasEarTag ? 1 : 0.4,
              }}
            >
              Ohrmarke vorhanden
            </button>
            <button
              type="button"
              onClick={() => {
                setHasEarTag(false);
                setEarTag("");
              }}
              className="rounded-lg px-2 py-2 text-sm font-medium border transition"
              style={{
                backgroundColor: "white",
                color: "#2B2A26",
                borderColor: !hasEarTag ? "#2B2A26" : "#9CA3AF",
                opacity: !hasEarTag ? 1 : 0.4,
              }}
            >
              Noch nicht vergeben
            </button>
          </div>
        )}

        {tagPending ? (
          <p className="text-xs text-[#8A8672] mb-3">
            Das Kalb wird ohne Ohrmarke angelegt. Trag die Nummer nach, sobald sie vergeben wurde.
          </p>
        ) : (
          <input
            autoFocus
            value={earTag}
            onChange={(e) => {
              setEarTag(liveFormatEarTag(e.target.value));
              if (invalidFields.earTag) setInvalidFields((f) => ({ ...f, earTag: false }));
            }}
            placeholder="z. B. DE 04 123 45678"
            className="w-full mb-3 px-3 py-2 rounded-lg border bg-white text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
            style={{ borderColor: invalidFields.earTag ? "#B3261E" : "#9CA3AF" }}
          />
        )}

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Bella"
          className="w-full mb-3 px-3 py-2 rounded-lg border bg-white text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
          style={{ borderColor: "#9CA3AF" }}
        />

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
          Geschlecht{genderFixed || isUnregisteredLightEdit ? "" : " *"}
          <RequiredMark show={invalidFields.gender} />
        </label>
        {genderFixed ? (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-sm font-semibold inline-block bg-white border border-[#D9CFB8] text-[#2B2A26]"
          >
            {genderLabel(genderFixed)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => { setGender("weiblich"); setInvalidFields((f) => ({ ...f, gender: false })); }}
              className="rounded-lg px-2 py-2 text-sm font-medium border transition"
              style={{
                backgroundColor: "white",
                color: "#2B2A26",
                borderColor: gender === "weiblich" ? "#2B2A26" : "#9CA3AF",
                opacity: !gender || gender === "weiblich" ? 1 : 0.4,
              }}
            >
              weiblich
            </button>
            <button
              type="button"
              onClick={() => { setGender("männlich"); setInvalidFields((f) => ({ ...f, gender: false })); }}
              className="rounded-lg px-2 py-2 text-sm font-medium border transition"
              style={{
                backgroundColor: "white",
                color: "#2B2A26",
                borderColor: gender === "männlich" ? "#2B2A26" : "#9CA3AF",
                opacity: !gender || gender === "männlich" ? 1 : 0.4,
              }}
            >
              männlich
            </button>
          </div>
        )}

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
          Rasse (Rasseschlüssel){isUnregisteredLightEdit ? "" : " *"}
          <RequiredMark show={invalidFields.breedCode} />
        </label>
        <select
          value={breedCode}
          onChange={(e) => {
            setBreedCode(e.target.value);
            if (invalidFields.breedCode) setInvalidFields((f) => ({ ...f, breedCode: false }));
          }}
          className="w-full mb-3 px-3 py-2 rounded-lg border bg-white text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
          style={{ borderColor: invalidFields.breedCode ? "#B3261E" : "#9CA3AF" }}
        >
          <option value="">Bitte wählen…</option>
          {BREEDS.map((b) => (
            <option key={b.code} value={b.code}>
              {b.code} · {b.short} · {b.name}
            </option>
          ))}
        </select>

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
          Geburtsdatum{isUnregisteredLightEdit ? "" : " *"}
          <RequiredMark show={invalidFields.birthDate} />
        </label>
        <input
          type="date"
          value={birthDate}
          max={todayStr}
          onChange={(e) => {
            const v = e.target.value;
            if (v && v > todayStr) {
              setBirthDate("");
              setInvalidFields((f) => ({ ...f, birthDate: true }));
              setError("Das Geburtsdatum darf nicht in der Zukunft liegen.");
            } else {
              setBirthDate(v);
              if (invalidFields.birthDate) setInvalidFields((f) => ({ ...f, birthDate: false }));
            }
          }}
          className="mb-3 rounded-lg border bg-white text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
          style={{
            borderColor: invalidFields.birthDate ? "#B3261E" : "#9CA3AF",
            width: "1px",
            minWidth: "100%",
            boxSizing: "border-box",
            display: "block",
            padding: "0.5rem 0.75rem",
          }}
        />

        {showParents && (
          <>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
              Mutter (Ohrmarke){isCalf ? " *" : ", optional"}
              <RequiredMark show={invalidFields.motherEarTag} />
            </label>
            <EarTagSearchSelect
              value={motherEarTag}
              onChange={(v) => {
                setMotherEarTag(v);
                if (invalidFields.motherEarTag) setInvalidFields((f) => ({ ...f, motherEarTag: false }));
              }}
              options={mothers}
              placeholder="Ohrmarke oder Namen suchen…"
              emptyLabel={isCalf ? "Bitte wählen…" : "Unbekannt / keine Angabe"}
              invalid={invalidFields.motherEarTag}
              allowCreate
              onCreate={(rawEarTag) => {
                if (!isValidEarTag(rawEarTag)) {
                  setError("Die Ohrmarke muss im Format DE0836966741 sein (2 Buchstaben + 10 Ziffern, 12 Zeichen).");
                  return;
                }
                if (allAnimals.some((a) => sameEarTag(a.earTag, rawEarTag))) {
                  setError("Diese Ohrmarke ist bereits vergeben. Jede Ohrmarke darf nur einmal vorkommen.");
                  return;
                }
                const cleanedTag = cleanEarTag(rawEarTag);
                onCreateUnregistered(cleanedTag);
                setMotherEarTag(cleanedTag);
                if (invalidFields.motherEarTag) setInvalidFields((f) => ({ ...f, motherEarTag: false }));
                setError("");
              }}
            />
            {isCalf && mothers.length === 0 && (
              <p className="text-xs text-[#8A8672] -mt-2 mb-3">
                Noch keine Mutterkühe erfasst. Lege zuerst eine Mutterkuh an.
              </p>
            )}

            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
              Vater (Ohrmarke, optional)
            </label>
            <EarTagSearchSelect
              value={fatherEarTag}
              onChange={setFatherEarTag}
              options={fathers}
              placeholder="Ohrmarke oder Namen suchen…"
              emptyLabel="Unbekannt / keine Angabe"
              allowCreate
              onCreate={(rawEarTag) => {
                if (!isValidEarTag(rawEarTag)) {
                  setError("Die Ohrmarke muss im Format DE0836966741 sein (2 Buchstaben + 10 Ziffern, 12 Zeichen).");
                  return;
                }
                if (allAnimals.some((a) => sameEarTag(a.earTag, rawEarTag))) {
                  setError("Diese Ohrmarke ist bereits vergeben. Jede Ohrmarke darf nur einmal vorkommen.");
                  return;
                }
                const cleanedTag = cleanEarTag(rawEarTag);
                onCreateUnregistered(cleanedTag, "männlich");
                setFatherEarTag(cleanedTag);
                setError("");
              }}
            />
          </>
        )}

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">Stall</label>
        <select
          value={stall}
          onChange={(e) => setStall(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg border text-sm bg-white"
          style={{ borderColor: "#D9CFB8" }}
        >
          <option value="">Kein Stall zugewiesen</option>
          {staelle.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">Merkmale</label>
        <textarea
          value={merkmale}
          onChange={(e) => setMerkmale(e.target.value)}
          placeholder="z. B. weißer Fleck auf der Stirn"
          rows={2}
          className="w-full mb-3 px-3 py-2 rounded-lg border bg-white text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
          style={{ borderColor: "#9CA3AF" }}
        />

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
          Auffälligkeiten
        </label>
        <textarea
          value={auffaelligkeiten}
          onChange={(e) => setAuffaelligkeiten(e.target.value)}
          placeholder="z. B. humpelt leicht rechts hinten"
          rows={2}
          className="w-full mb-3 px-3 py-2 rounded-lg border bg-white text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
          style={{ borderColor: "#9CA3AF" }}
        />

        {error && <p className="text-[#8B3A3A] text-sm mt-2">{error}</p>}

        {initial && confirmingDelete ? (
          <div className="rounded-xl border border-[#8B3A3A] px-3 py-3 mt-5">
            <p className="text-sm text-[#2B2A26] mb-2">Dieses Tier wirklich löschen?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 py-2 rounded-lg font-medium"
                style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => onDelete(initial.id)}
                className="flex-1 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
              >
                Ja, löschen
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-5">
            {initial && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="p-2.5 rounded-lg"
                style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
                aria-label="Tier löschen"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg font-medium"
              style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 py-2.5 rounded-lg font-semibold active:scale-[0.98] transition"
              style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
            >
              Speichern
            </button>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-[#F9EFE4] last:border-b-0">
      <span className="text-[13px] text-[#8A8672]">{label}</span>
      <span className="text-[13px] font-medium text-[#2B2A26] text-right">{value}</span>
    </div>
  );
}

function moveOptions(animal) {
  if (animal.category === "Mutterkühe") return ["Abgänge"];
  if (animal.category === "Deckbullen") return ["Abgänge"];
  if (animal.category === "Kälber") {
    return animal.gender === "weiblich" ? ["Abgänge", "Jungrinder"] : ["Abgänge"];
  }
  if (animal.category === "Jungrinder") return ["Abgänge", "Mutterkühe"];
  if (animal.category === "Unregistriert") return [...CATEGORIES, "Abgänge"];
  return [];
}

function AnimalPass({ animal, allAnimals, onEdit, onClose, onOpenAnimal, onShowAllDescendants, onUpdateField, onMove, onOpenBreedingHistory, onOpenStallbuch, onRequestAbgang }) {
  const isAdmin = useContext(AppModeContext) === "admin";
  const [moving, setMoving] = useState(false);
  const [stallDraft, setStallDraft] = useState(animal.stall || "");
  const [stallDate, setStallDate] = useState(isoDateKey(new Date()));
  const { staelle } = useStaelle();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showFullPass, setShowFullPass] = useState(false);
  const color = colorForCategory(animal.category);
  const [editingField, setEditingField] = useState(null);
  const [fieldDraft, setFieldDraft] = useState("");

  const startFieldEdit = (field) => {
    setEditingField(field);
    setFieldDraft(animal[field] || "");
  };
  const cancelFieldEdit = () => setEditingField(null);
  const saveFieldEdit = () => {
    onUpdateField(animal.id, { [editingField]: fieldDraft.trim() });
    setEditingField(null);
  };
  const isAbgangView = animal.category === "Abgänge" && !showFullPass;
  const headingColor = isAbgangView ? "#2B2A26" : PASS_BLUE;

  const mother = findByEarTag(allAnimals, animal.motherEarTag);
  const father = findByEarTag(allAnimals, animal.fatherEarTag);

  const calves = useMemo(() => {
    if ((animal.category !== "Mutterkühe" && animal.category !== "Jungrinder") || !animal.earTag) return [];
    return allAnimals
      .filter((a) => sameEarTag(a.motherEarTag, animal.earTag))
      .sort((a, b) => {
        if (!a.birthDate && !b.birthDate) return 0;
        if (!a.birthDate) return 1;
        if (!b.birthDate) return -1;
        return new Date(b.birthDate) - new Date(a.birthDate);
      });
  }, [animal, allAnimals]);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)", paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-lg">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-[#F2EBDD] transition"
          aria-label="Pass schließen"
        >
          <X size={20} className="text-[#2B2A26]" />
        </button>
        <div
          className="w-full bg-white rounded-t-2xl sm:rounded-2xl border-2 overflow-y-auto"
          style={{ borderColor: PASS_BLUE, maxHeight: "min(94vh, 94dvh)" }}
        >
          <p
            className="font-slab text-3xl font-bold px-4 pt-3 pb-2 text-left rounded-t-2xl sm:rounded-t-2xl"
            style={{ color: headingColor, backgroundColor: isAbgangView ? "#D4C1D7" : "#CFDBEB" }}
          >
            {isAbgangView ? "Abgangspass" : "Rinderpass"}
          </p>

          <div className="px-5 py-4 rounded-b-2xl" style={{ backgroundColor: isAbgangView ? "#D4C1D7" : "#CFDBEB" }}>
            <div
              className="relative flex items-center justify-center min-h-[72px] py-4 px-2 rounded-xl border mb-4"
              style={{ backgroundColor: color.bg, color: color.fg, borderColor: PASS_BLUE }}
            >
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-slab text-xl font-bold leading-tight text-left">
                {zugehoerigkeit(animal, !isAbgangView)}
              </span>
              <span className="font-slab text-xl font-bold text-center break-all">
                {formatEarTag(animal.earTag) || "ausstehend"}
              </span>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mx-8 mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: headingColor }}>
                Informationen
              </h3>
              <div className="rounded-xl border bg-white px-3 py-1" style={{ borderColor: PASS_BLUE }}>
                <InfoRow label="Ohrmarke" value={formatEarTag(animal.earTag) || "ausstehend"} />
                <InfoRow label="Name" value={animal.name || "Unbenannt"} />
                <InfoRow label="Rasse" value={animal.breed ? `${animal.breed}${animal.breedCode ? ` (${animal.breedCode})` : ""}` : "–"} />
                <InfoRow label="Geschlecht" value={genderLabel(animal.gender)} />
                <InfoRow label="Geburtsdatum" value={formatDate(animal.birthDate)} />
                <InfoRow
                  label="Alter"
                  value={formatAgeShort(animal.birthDate, animal.category === "Abgänge" && animal.abgangsDatum ? animal.abgangsDatum : undefined)}
                />
                {animal.category !== "Abgänge" && <InfoRow label="Stall" value={animal.stall || "–"} />}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: headingColor }}>
                  Merkmale
                </h3>
                {isAdmin && editingField !== "merkmale" && (
                  <button
                    type="button"
                    onClick={() => startFieldEdit("merkmale")}
                    className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
                    aria-label="Merkmale bearbeiten"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              {editingField === "merkmale" ? (
                <div className="mb-3">
                  <textarea
                    autoFocus
                    value={fieldDraft}
                    onChange={(e) => setFieldDraft(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border bg-white text-sm text-[#2B2A26] focus:outline-none"
                    style={{ borderColor: PASS_BLUE }}
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={cancelFieldEdit}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={saveFieldEdit}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border bg-white px-3 py-2 mb-3 text-sm text-[#2B2A26] whitespace-pre-wrap"
                  style={{ borderColor: PASS_BLUE }}
                >
                  {animal.merkmale || "–"}
                </div>
              )}

              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: headingColor }}>
                  Auffälligkeiten
                </h3>
                {isAdmin && editingField !== "auffaelligkeiten" && (
                  <button
                    type="button"
                    onClick={() => startFieldEdit("auffaelligkeiten")}
                    className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
                    aria-label="Auffälligkeiten bearbeiten"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              {editingField === "auffaelligkeiten" ? (
                <div>
                  <textarea
                    autoFocus
                    value={fieldDraft}
                    onChange={(e) => setFieldDraft(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border bg-white text-sm text-[#2B2A26] focus:outline-none"
                    style={{ borderColor: PASS_BLUE }}
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={cancelFieldEdit}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={saveFieldEdit}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border bg-white px-3 py-2 text-sm text-[#2B2A26] whitespace-pre-wrap"
                  style={{ borderColor: PASS_BLUE }}
                >
                  {animal.auffaelligkeiten || "–"}
                </div>
              )}
            </div>
          </div>

          {isAbgangView ? (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 mx-8" style={{ color: headingColor }}>
                Abgangsdaten
              </h3>
              <div className="rounded-xl border bg-white px-3 py-1 mb-4 mx-8" style={{ borderColor: PASS_BLUE }}>
                <InfoRow label="Datum des Abgangs" value={formatDate(animal.abgangsDatum)} />
                {animal.abgangsGrund === "verendet" && (
                  <>
                    <InfoRow label="Todesursache" value={animal.todesursache || "–"} />
                    <InfoRow label="Notizen/Grund" value={animal.todesnotizen || "–"} />
                  </>
                )}
                {animal.abgangsGrund === "verkauft" && (
                  <>
                    <InfoRow label="Verkaufspreis" value={animal.verkaufspreis ? `${animal.verkaufspreis} €` : "–"} />
                    <InfoRow label="Grund des Verkaufs" value={animal.verkaufsgrund || "–"} />
                    <InfoRow label="Verkauft an" value={animal.verkauftAn || "–"} />
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 mx-8" style={{ color: headingColor }}>
                Abstammung
              </h3>
              <div className="rounded-xl border bg-white px-3 py-1 mb-4 mx-8" style={{ borderColor: PASS_BLUE }}>
                <InfoRow
                  label="Mutter"
                  value={
                    animal.motherEarTag ? (
                      mother ? (
                        <button
                          type="button"
                          onClick={() => onOpenAnimal(mother)}
                          className="underline decoration-dotted text-[#2B2A26]"
                        >
                          {formatEarTag(mother.earTag)}
                        </button>
                      ) : (
                        `${animal.motherEarTag} (nicht gefunden)`
                      )
                    ) : (
                      "–"
                    )
                  }
                />
                <InfoRow
                  label="Vater"
                  value={
                    animal.fatherEarTag ? (
                      father ? (
                        <button
                          type="button"
                          onClick={() => onOpenAnimal(father)}
                          className="underline decoration-dotted text-[#2B2A26]"
                        >
                          {formatEarTag(father.earTag)}
                        </button>
                      ) : (
                        `${animal.fatherEarTag} (nicht gefunden)`
                      )
                    ) : (
                      "–"
                    )
                  }
                />
              </div>
            </>
          )}

          {(animal.category === "Mutterkühe" || animal.category === "Jungrinder") && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 mx-8" style={{ color: headingColor }}>
                Nachkommen ({calves.length})
              </h3>
              <div className="rounded-xl border bg-white mb-4 mx-8 overflow-hidden" style={{ borderColor: PASS_BLUE }}>
                {calves.length === 0 ? (
                  <p className="text-sm text-[#B0A98F] italic px-3 py-2">Noch keine Nachkommen erfasst.</p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-white text-[#6B6858] text-[11px] uppercase tracking-wide">
                        <th className="text-left font-semibold px-3 py-1.5">Ohrmarke</th>
                        <th className="text-left font-semibold px-3 py-1.5">Geschlecht</th>
                        <th className="text-left font-semibold px-3 py-1.5">Geburtsdatum</th>
                        <th className="text-left font-semibold px-3 py-1.5">Alter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calves.slice(0, 3).map((c) => (
                        <tr
                          key={c.id}
                          className="border-t border-[#F9EFE4] cursor-pointer bg-white hover:bg-[#F9EFE4]"
                          onClick={() => onOpenAnimal(c)}
                        >
                          <td className="px-3 py-1.5 text-[#2B2A26]">{formatEarTag(c.earTag) || "ausstehend"}</td>
                          <td className="px-3 py-1.5 text-[#2B2A26]">
                            {c.gender === "weiblich" ? "weiblich" : c.gender === "männlich" ? "männlich" : "–"}
                          </td>
                          <td className="px-3 py-1.5 text-[#2B2A26]">{formatDate(c.birthDate)}</td>
                          <td className="px-3 py-1.5 text-[#2B2A26]">{formatAgeShort(c.birthDate)}</td>
                        </tr>
                      ))}
                      {calves.length > 3 && (
                        <tr className="border-t border-[#F9EFE4]">
                          <td colSpan={4} className="p-0">
                            <button
                              type="button"
                              onClick={() => onShowAllDescendants(animal)}
                              className="w-full text-center px-3 py-2 text-sm font-semibold hover:bg-[#F2EBDD] transition"
                              style={{ color: PASS_BLUE }}
                            >
                              Zeige alle Nachkommen
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {isAdmin && (moving ? (
            <div className="rounded-xl border px-3 py-3" style={{ borderColor: PASS_BLUE }}>
              {animal.category !== "Unregistriert" && animal.category !== "Abgänge" && (
                <>
                  <p className="text-sm text-[#2B2A26] mb-2">Umstallen</p>
                  <select
                    value={stallDraft}
                    onChange={(e) => setStallDraft(e.target.value)}
                    className="w-full mb-2 text-sm px-2 py-1.5 rounded-lg border bg-white"
                    style={{ borderColor: "#D9CFB8" }}
                  >
                    <option value="">Kein Stall zugewiesen</option>
                    {staelle.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="date"
                      value={stallDate}
                      max={isoDateKey(new Date())}
                      onChange={(e) => setStallDate(e.target.value)}
                      className="flex-1 text-sm px-2 py-1.5 rounded-lg border bg-white"
                      style={{ borderColor: "#D9CFB8" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const history = Array.isArray(animal.history) ? animal.history : [];
                        const entry = {
                          type: "stall_umgestallt",
                          date: stallDate,
                          von: animal.stall || "Kein Stall",
                          nach: stallDraft || "Kein Stall",
                        };
                        onUpdateField(animal.id, { stall: stallDraft, history: [...history, entry] });
                      }}
                      disabled={stallDraft === (animal.stall || "")}
                      className="text-xs font-semibold rounded-lg px-3"
                      style={{
                        backgroundColor: stallDraft === (animal.stall || "") ? "#D9CFB8" : "#4C6B3F",
                        color: stallDraft === (animal.stall || "") ? "#8A8672" : "#F2EBDD",
                      }}
                    >
                      Speichern
                    </button>
                  </div>
                </>
              )}
              <p className="text-sm text-[#2B2A26] mb-2">Wohin soll das Tier verschoben werden?</p>
              <div className="flex flex-col gap-2 mb-2">
                {moveOptions(animal).map((dest) => {
                  const color = colorForCategory(dest) || { bg: "#6B6858", fg: "#FFFFFF" };
                  return (
                    <button
                      type="button"
                      key={dest}
                      onClick={() => {
                        setMoving(false);
                        if (dest === "Abgänge") {
                          onRequestAbgang(animal);
                        } else {
                          onMove(animal.id, dest);
                        }
                      }}
                      className="w-full py-2.5 rounded-lg font-semibold text-left px-3"
                      style={{ backgroundColor: color.bg, color: color.fg }}
                    >
                      {dest}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setMoving(false)}
                className="w-full py-2 rounded-lg font-medium"
                style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (animal.category === "Unregistriert" ? onEdit(animal, true) : setMoving(true))}
                className="flex-1 py-2.5 rounded-lg bg-[#4C6B3F] text-[#F2EBDD] font-semibold hover:bg-[#3F5A34] active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                {animal.category === "Unregistriert" ? (
                  <>
                    <Plus size={16} />
                    Registrieren
                  </>
                ) : (
                  <>
                    <ArrowUpDown size={16} />
                    Verschieben
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onEdit(animal)}
                className="flex-1 py-2.5 rounded-lg bg-[#4C6B3F] text-[#F2EBDD] font-semibold hover:bg-[#3F5A34] active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <Pencil size={16} />
                Pass bearbeiten
              </button>
            </div>
          ))}

          <div className="relative flex justify-end mt-3">
            {moreMenuOpen && (
              <div
                className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border bg-white shadow-lg overflow-hidden z-20"
                style={{ borderColor: "#D9CFB8" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onShowAllDescendants(animal);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F9EFE4] transition"
                  style={{ color: "#2B2A26" }}
                >
                  Historie
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onOpenStallbuch(animal);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F9EFE4] transition border-t"
                  style={{ color: "#2B2A26", borderColor: "#F2EBDD" }}
                >
                  Stallbuch
                </button>
                {animal.category === "Abgänge" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setShowFullPass((v) => !v);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F9EFE4] transition border-t"
                    style={{ color: "#2B2A26", borderColor: "#F2EBDD" }}
                  >
                    {isAbgangView ? "Rinderpass" : "Abgangspass"}
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMoreMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F9EFE4] transition"
              style={{ backgroundColor: "#F2EBDD" }}
              aria-label="Weitere Optionen"
            >
              <MoreVertical size={18} style={{ color: "#2B2A26" }} />
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function PendingTagCallout({ calves, onOpenAnimal }) {
  const pending = calves.filter((c) => !c.earTag);
  if (pending.length === 0) return null;
  return (
    <div className="mb-3 rounded-xl border border-[#C99A3B] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A6D2A] mb-2">
        Ohrmarke ausstehend ({pending.length})
      </p>
      <div className="flex flex-col gap-1.5">
        {pending.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => onOpenAnimal(c)}
            className="flex items-center justify-between gap-2 rounded-lg bg-[#F9EFE4] hover:bg-[#F3E3C0] px-2.5 py-1.5 text-left transition"
          >
            <span className="min-w-0 truncate text-sm font-medium text-[#2B2A26]">
              {c.name || "Unbenannt"}
            </span>
            <span className="text-xs text-[#8A8672] shrink-0">{formatAgeShort(c.birthDate)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Abgänge: neuestes Abgangsdatum zuerst, Tiere ohne Datum ans Ende
function sortByAbgangsDatum(list) {
  return [...list].sort((x, y) => {
    if (!x.abgangsDatum && !y.abgangsDatum) return 0;
    if (!x.abgangsDatum) return 1;
    if (!y.abgangsDatum) return -1;
    return x.abgangsDatum < y.abgangsDatum ? 1 : x.abgangsDatum > y.abgangsDatum ? -1 : 0;
  });
}

function SectionTable({ title, color, animals, onOpenAnimal, showParents, showGender, showAbgangsDatum, collapsible }) {
  const mobileScroll = useContext(MobileScrollContext);
  const [collapsed, setCollapsed] = useState(false);
  const headerContent = (
    <>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color.bg }} />
      <h2 className="font-slab text-[15px] font-bold text-[#2B2A26] uppercase tracking-wide">{title}</h2>
      <span className="text-[12px] text-[#8A8672]">({animals.length})</span>
    </>
  );
  return (
    <section className="mb-6">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center gap-2 mb-2 px-0.5 text-left"
          aria-label={collapsed ? `${title} aufklappen` : `${title} zuklappen`}
          aria-expanded={!collapsed}
        >
          <ChevronRight
            size={16}
            className="shrink-0"
            style={{ color: "#6B6858", transform: collapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.15s" }}
          />
          {headerContent}
        </button>
      ) : (
        <div className="flex items-center gap-2 mb-2 px-0.5">{headerContent}</div>
      )}
      {collapsible && collapsed ? null : animals.length === 0 ? (
        <p className="text-sm text-[#B0A98F] italic px-0.5">Keine Tiere in diesem Abschnitt.</p>
      ) : (
        <div className={`rounded-xl border border-[#D9CFB8] bg-white ${mobileScroll ? "overflow-x-auto" : "overflow-hidden"}`}>
          <table className="w-full text-[13px]" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: mobileScroll ? 560 : undefined }}>
            <thead>
              <tr className="bg-white text-[#6B6858] text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold px-3 py-2 rounded-tl-xl">Name</th>
                <th className="text-left font-semibold px-3 py-2">Ohrmarke</th>
                {showAbgangsDatum && <th className="text-left font-semibold px-3 py-2">Abgangsdatum</th>}
                <th className="text-left font-semibold px-3 py-2">Geb.datum</th>
                <th className="text-left font-semibold px-3 py-2">Alter</th>
                {showGender && <th className="text-left font-semibold px-3 py-2">Geschlecht</th>}
                {showParents && (
                  <>
                    <th className="text-left font-semibold px-3 py-2">Mutter</th>
                    <th className="text-left font-semibold px-3 py-2">Vater</th>
                  </>
                )}
                <th className="w-6 px-2 py-2 rounded-tr-xl"></th>
              </tr>
            </thead>
            <tbody>
              {animals.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => onOpenAnimal(a)}
                  className="border-t border-[#F9EFE4] cursor-pointer bg-white hover:bg-[#F9EFE4] transition"
                >
                  <td className="px-3 py-2 text-[#2B2A26] font-medium truncate max-w-[110px]">
                    {a.name || "Unbenannt"}
                  </td>
                  <td className="px-3 py-2 text-[#2B2A26]">{formatEarTag(a.earTag) || "ausstehend"}</td>
                  {showAbgangsDatum && <td className="px-3 py-2 text-[#2B2A26]">{a.abgangsDatum ? formatDate(a.abgangsDatum) : "–"}</td>}
                  <td className="px-3 py-2 text-[#2B2A26]">{formatDate(a.birthDate)}</td>
                  <td className="px-3 py-2 text-[#2B2A26]">
                    {formatAgeShort(a.birthDate, a.category === "Abgänge" && a.abgangsDatum ? a.abgangsDatum : undefined)}
                  </td>
                  {showGender && <td className="px-3 py-2 text-[#2B2A26]">{genderLabel(a.gender)}</td>}
                  {showParents && (
                    <>
                      <td className="px-3 py-2 text-[#2B2A26]">{shortEarTag(a.motherEarTag) || "–"}</td>
                      <td className="px-3 py-2 text-[#2B2A26]">{shortEarTag(a.fatherEarTag) || "–"}</td>
                    </>
                  )}
                  <td className="px-2 py-2 text-[#B0A98F]">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TreeBackgroundSVG() {
  return (
    <svg
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.14 }}
    >
      <path
        d="M190,500 L188,260 Q182,210 155,175 Q188,195 197,225 Q200,190 200,160 Q200,190 203,225 Q212,195 245,175 Q218,210 212,260 L210,500 Z"
        fill="#6B4E2E"
      />
      <circle cx="200" cy="150" r="130" fill="#9BC17C" />
      <circle cx="110" cy="200" r="95" fill="#8AB56C" />
      <circle cx="290" cy="200" r="95" fill="#8AB56C" />
      <circle cx="150" cy="90" r="100" fill="#A9CB8C" />
      <circle cx="250" cy="90" r="100" fill="#A9CB8C" />
      <circle cx="200" cy="60" r="90" fill="#B7D89C" />
    </svg>
  );
}

function TreeNode({ animal, byMother, depth, onOpenAnimal, visited }) {
  if (visited.has(animal.id)) return null; // Sicherheit gegen Zirkelbezüge
  visited.add(animal.id);
  const color = colorForCategory(animal.category);
  const children = (byMother[cleanEarTag(animal.earTag)] || []).sort((a, b) => {
    if (!a.birthDate && !b.birthDate) return 0;
    if (!a.birthDate) return 1;
    if (!b.birthDate) return -1;
    return new Date(a.birthDate) - new Date(b.birthDate);
  });
  const initial = (animal.name || animal.category || "?").trim().slice(0, 1).toUpperCase();

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpenAnimal(animal)}
        className="w-full flex items-center gap-2 py-1.5 pl-2 pr-2 rounded-lg hover:bg-white/70 transition text-left"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 border-white"
          style={{ backgroundColor: color.bg, color: color.fg, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
        >
          {initial}
        </span>
        <span className="text-sm font-semibold text-[#2B2A26] shrink-0">
          {formatEarTag(animal.earTag) || "ausstehend"}
        </span>
        {animal.name && <span className="text-sm text-[#6B6858] truncate">– {animal.name}</span>}
        <span className="text-xs text-[#8A8672] ml-auto shrink-0">{animal.category}</span>
      </button>
      {children.length > 0 && (
        <div className="ml-4 pl-3 border-l-2" style={{ borderColor: "#B7C9A8" }}>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              animal={child}
              byMother={byMother}
              depth={depth + 1}
              onOpenAnimal={onOpenAnimal}
              visited={visited}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AncestorBox({ animal, onOpenAnimal }) {
  if (!animal) {
    return (
      <div
        className="rounded-md border-2 border-dashed px-2 py-1.5 text-center min-w-[110px]"
        style={{ borderColor: "#C9D3C1" }}
      >
        <p className="text-[10px] text-[#B0A98F]">unbekannt</p>
      </div>
    );
  }
  const color = colorForCategory(animal.category);
  return (
    <button
      type="button"
      onClick={() => onOpenAnimal(animal)}
      className="rounded-md border px-2 py-1.5 text-left min-w-[110px] hover:opacity-90 transition"
      style={{ backgroundColor: color.bg, borderColor: color.bg }}
    >
      <p className="text-[10px] font-bold leading-tight" style={{ color: color.fg }}>
        {formatEarTag(animal.earTag) || "ausstehend"}
      </p>
      {animal.name && (
        <p className="text-[9px] leading-tight truncate" style={{ color: color.fg }}>
          {animal.name}
        </p>
      )}
    </button>
  );
}

function AncestorBranch({ animal, allAnimals, onOpenAnimal, visited }) {
  const known = animal && !visited.has(animal.id);
  if (known) visited.add(animal.id);
  const mother = known ? findByEarTag(allAnimals, animal.motherEarTag) : null;
  const father = known ? findByEarTag(allAnimals, animal.fatherEarTag) : null;
  const hasParents = !!(mother || father);

  return (
    <div className="flex items-stretch">
      <div className="flex items-center">
        <AncestorBox animal={known ? animal : null} onOpenAnimal={onOpenAnimal} />
      </div>
      {hasParents && (
        <div className="flex items-center">
          <div className="w-4 h-0.5 shrink-0" style={{ backgroundColor: "#B7C9A8" }} />
          <div className="flex flex-col gap-2 border-l-2 pl-0" style={{ borderColor: "#B7C9A8" }}>
            <div className="flex items-center">
              <div className="w-3 h-0.5 shrink-0" style={{ backgroundColor: "#B7C9A8" }} />
              <AncestorBranch animal={mother} allAnimals={allAnimals} onOpenAnimal={onOpenAnimal} visited={visited} />
            </div>
            <div className="flex items-center">
              <div className="w-3 h-0.5 shrink-0" style={{ backgroundColor: "#B7C9A8" }} />
              <AncestorBranch animal={father} allAnimals={allAnimals} onOpenAnimal={onOpenAnimal} visited={visited} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnimalPedigreeView({ animal, allAnimals, onOpenAnimal }) {
  const byMother = useMemo(() => {
    const map = {};
    allAnimals.forEach((a) => {
      if (a.motherEarTag) {
        const key = cleanEarTag(a.motherEarTag);
        if (!map[key]) map[key] = [];
        map[key].push(a);
      }
    });
    return map;
  }, [allAnimals]);

  const mother = findByEarTag(allAnimals, animal.motherEarTag);
  const father = findByEarTag(allAnimals, animal.fatherEarTag);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#2B2A26" }}>
          Vorfahren
        </h3>
        {!mother && !father ? (
          <p className="text-sm text-[#B0A98F] italic px-0.5">Keine Vorfahren bekannt.</p>
        ) : (
          <div className="rounded-lg bg-white/60 p-2 overflow-x-auto">
            <AncestorBranch animal={animal} allAnimals={allAnimals} onOpenAnimal={onOpenAnimal} visited={new Set()} />
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#2B2A26" }}>
          Nachfahren
        </h3>
        {!(byMother[cleanEarTag(animal.earTag)] || []).length ? (
          <p className="text-sm text-[#B0A98F] italic px-0.5">Keine Nachfahren bekannt.</p>
        ) : (
          <div className="rounded-lg bg-white/60 p-1">
            <TreeNode
              animal={animal}
              byMother={byMother}
              depth={0}
              onOpenAnimal={onOpenAnimal}
              visited={new Set()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StammbaumSearch({ animals, onSelect }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = !q
    ? []
    : animals
        .filter((a) => (a.earTag || "").toLowerCase().includes(q) || (a.name || "").toLowerCase().includes(q))
        .slice(0, 8);

  return (
    <div className="relative mb-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tier suchen (Ohrmarke oder Name)…"
        className="w-full px-3 py-2 rounded-lg border bg-white text-[#2B2A26] text-sm focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
        style={{ borderColor: "#9CA3AF" }}
      />
      {q && (
        <div className="mt-1 rounded-lg border border-[#D9CFB8] bg-white shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[#B0A98F]">Keine Treffer</p>
          ) : (
            results.map((a) => {
              const color = colorForCategory(a.category);
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => {
                    onSelect(a);
                    setQuery("");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F9EFE4] transition"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.bg }} />
                  <span className="text-sm font-semibold text-[#2B2A26]">
                    {formatEarTag(a.earTag) || "ausstehend"}
                  </span>
                  {a.name && <span className="text-sm text-[#8A8672] truncate">– {a.name}</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function StammbaumView({ animals, onBack, onOpenAnimal }) {
  const [pedigreeAnimal, setPedigreeAnimal] = useState(null);

  const byMother = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (a.motherEarTag) {
        const key = cleanEarTag(a.motherEarTag);
        if (!map[key]) map[key] = [];
        map[key].push(a);
      }
    });
    return map;
  }, [animals]);

  const roots = useMemo(() => {
    const earTags = new Set(animals.filter((a) => a.earTag).map((a) => cleanEarTag(a.earTag)));
    return animals
      .filter((a) => !a.motherEarTag || !earTags.has(cleanEarTag(a.motherEarTag)))
      .sort((a, b) => (a.earTag || "").localeCompare(b.earTag || ""));
  }, [animals]);

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto" style={{ backgroundColor: "#F9EFE4" }}>
      <div
        className="sticky top-0 z-10 backdrop-blur border-b border-[#D9CFB8] px-5 pt-6 pb-4 flex items-center justify-between gap-3"
        style={{ backgroundColor: "rgba(249, 239, 228, 0.95)" }}
      >
        <h1 className="font-slab text-lg font-bold text-[#2B2A26]">Stammbaum</h1>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 transition"
          style={{ color: "#FFFFFF", backgroundColor: "#2B2A26" }}
        >
          Zurück zur Hauptseite
        </button>
      </div>
      <div className="px-5 py-4 pb-10">
        <StammbaumSearch animals={animals} onSelect={setPedigreeAnimal} />
        {animals.length === 0 ? (
          <p className="text-sm text-[#8A8672] text-center mt-10">Noch keine Tiere erfasst.</p>
        ) : pedigreeAnimal ? (
          <div
            className="relative rounded-xl border p-3 overflow-hidden"
            style={{ borderColor: "#B7C9A8", backgroundColor: "rgba(255,255,255,0.88)" }}
          >
            <TreeBackgroundSVG />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-slab text-sm font-bold text-[#2B2A26]">Ahnentafel</h2>
                <button
                  type="button"
                  onClick={() => setPedigreeAnimal(null)}
                  className="text-xs font-semibold rounded-lg px-3 py-1.5"
                  style={{ color: "#FFFFFF", backgroundColor: "#2B2A26" }}
                >
                  Zurück zur Übersicht
                </button>
              </div>
              <AnimalPedigreeView animal={pedigreeAnimal} allAnimals={animals} onOpenAnimal={onOpenAnimal} />
            </div>
          </div>
        ) : (
          <div
            className="relative rounded-xl border p-3 overflow-hidden"
            style={{ borderColor: "#B7C9A8", backgroundColor: "rgba(255,255,255,0.88)" }}
          >
            <TreeBackgroundSVG />
            <div className="relative">
              {roots.map((root) => (
                <TreeNode
                  key={root.id}
                  animal={root}
                  byMother={byMother}
                  depth={0}
                  onOpenAnimal={onOpenAnimal}
                  visited={new Set()}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const HISTORIE_TABS = [
  ["brunsthistorie", "Brunsthistorie"],
  ["nachkommen", "Nachkommen"],
  ["stallbewegung", "Stall Bewegung"],
  ["deckbullen", "Deckbullen"],
];

function HistorieView({ animal, allAnimals, onBack, onOpenAnimal, initialTab, onTabChange }) {
  const current = allAnimals.find((a) => a.id === animal.id) || animal;
  const isFemale = current.gender === "weiblich";
  const visibleTabs = HISTORIE_TABS.filter(([key]) => isFemale || (key !== "brunsthistorie" && key !== "deckbullen"));
  const [tab, setTab] = useState(
    initialTab && visibleTabs.some(([key]) => key === initialTab) ? initialTab : visibleTabs[0][0]
  );
  // Aktuellen Reiter nach oben melden, damit die Adresse (URL) ihn mitführt
  useEffect(() => {
    if (onTabChange) onTabChange(tab);
  }, [tab]);
  const [ahnentafelOpen, setAhnentafelOpen] = useState(false);

  const breedingEvents = (current.history || [])
    .filter((ev) => ev.type !== "umgestallt" && ev.type !== "stall_umgestallt")
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const stallEvents = (current.history || [])
    .filter((ev) => ev.type === "umgestallt" || ev.type === "stall_umgestallt")
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const hasStallDateForCurrent =
    current.stall &&
    (current.history || []).some((ev) => ev.type === "stall_umgestallt" && ev.nach === current.stall);
  const stallOhneDatum = current.stall && !hasStallDateForCurrent ? current.stall : null;

  const deckbullenOverlaps = useMemo(() => {
    const myTimeline = buildStallTimeline(current);
    if (myTimeline.length === 0) return [];
    const bulls = allAnimals.filter((a) => a.category === "Deckbullen");
    const rows = [];
    bulls.forEach((bull) => {
      const bullTimeline = buildStallTimeline(bull);
      myTimeline.forEach((segA) => {
        bullTimeline.forEach((segB) => {
          const ov = overlapPeriod(segA, segB);
          if (ov) rows.push({ bull, ...ov });
        });
      });
    });
    rows.sort((a, b) => (a.from || "0") < (b.from || "0") ? 1 : -1);
    return rows;
  }, [current, allAnimals]);

  const descendants = useMemo(
    () =>
      allAnimals
        .filter((a) => animal.earTag && sameEarTag(a.motherEarTag, animal.earTag))
        .sort((a, b) => {
          if (!a.birthDate && !b.birthDate) return 0;
          if (!a.birthDate) return 1;
          if (!b.birthDate) return -1;
          return new Date(b.birthDate) - new Date(a.birthDate);
        }),
    [animal, allAnimals]
  );

  const byCategory = useMemo(() => {
    const map = {};
    CATEGORIES.forEach((c) => (map[c] = []));
    descendants.forEach((a) => {
      if (CATEGORIES.includes(a.category)) map[a.category].push(a);
    });
    return map;
  }, [descendants]);

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto" style={{ backgroundColor: "#F9EFE4" }}>
      <div
        className="sticky top-0 z-10 backdrop-blur border-b border-[#D9CFB8] px-5 pt-6 pb-4"
        style={{ backgroundColor: "rgba(249, 239, 228, 0.95)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-[#8A8672]">Historie</p>
            <h1 className="font-slab text-lg font-bold text-[#2B2A26] truncate">
              {formatEarTag(current.earTag) || "ausstehend"}
              {current.name ? ` – ${current.name}` : ""}
            </h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 transition"
            style={{ color: "#FFFFFF", backgroundColor: "#2B2A26" }}
          >
            Zurück
          </button>
        </div>
        <div className="flex rounded-full border border-[#D9CFB8] bg-white p-0.5 gap-0.5 overflow-x-auto">
          {visibleTabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="text-[13px] font-medium rounded-full px-3 py-1.5 whitespace-nowrap flex-1"
              style={
                tab === key
                  ? { backgroundColor: "#2B2A26", color: "#F2EBDD" }
                  : { backgroundColor: "transparent", color: "#6B6858" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 pb-10">
        {tab === "brunsthistorie" && (
          <>
            <p className="text-xs mb-3" style={{ color: "#8A8672" }}>
              Alle erfassten Brunst-/Besamungs-Ereignisse dieses Tieres, neueste zuerst.
            </p>
            {breedingEvents.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "#B0A98F" }}>
                Noch keine Ereignisse erfasst.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {breedingEvents.map((ev, i) => {
                  const info = BREEDING_HISTORY_LABELS[ev.type] || { label: ev.type, color: "#6B6858" };
                  return (
                    <div key={i} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "#D9CFB8", backgroundColor: "#FFFFFF" }}>
                      <span className="text-sm" style={{ color: info.color }}>
                        {info.label}
                      </span>
                      <span className="text-xs" style={{ color: "#8A8672" }}>
                        {new Date(ev.date).toLocaleDateString("de-DE")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "nachkommen" && (
          <>
            <div
              className="relative rounded-xl border p-3 overflow-hidden mb-6"
              style={{ borderColor: "#B7C9A8", backgroundColor: "rgba(255,255,255,0.88)" }}
            >
              <TreeBackgroundSVG />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAhnentafelOpen((v) => !v)}
                  className="flex items-center gap-1.5 mb-3"
                >
                  <h2 className="font-slab text-sm font-bold text-[#2B2A26]">Ahnentafel</h2>
                  <ChevronRight
                    size={16}
                    style={{ color: "#6B6858", transform: ahnentafelOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                  />
                </button>
                {ahnentafelOpen && (
                  <AnimalPedigreeView animal={current} allAnimals={allAnimals} onOpenAnimal={onOpenAnimal} />
                )}
              </div>
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 px-0.5" style={{ color: "#6B6858" }}>
              Nachkommen
            </h3>
            {CATEGORIES.map((cat) => (
              <SectionTable
                key={cat}
                title={cat}
                color={colorForCategory(cat)}
                animals={byCategory[cat]}
                onOpenAnimal={onOpenAnimal}
                showParents={cat === "Kälber" || cat === "Jungrinder"}
                showGender={cat === "Kälber"}
              />
            ))}
          </>
        )}

        {tab === "stallbewegung" && (
          <>
            <p className="text-xs mb-3" style={{ color: "#8A8672" }}>
              Alle Abschnitts- und Stallwechsel dieses Tieres, neueste zuerst.
            </p>
            {stallEvents.length === 0 && !stallOhneDatum ? (
              <p className="text-sm text-center py-6" style={{ color: "#B0A98F" }}>
                Noch keine Stall-Bewegungen erfasst.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {stallOhneDatum && (
                  <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "#D9CFB8", backgroundColor: "#FFFFFF" }}>
                    <span className="text-sm" style={{ color: "#2B2A26" }}>
                      Stall: {stallOhneDatum}
                    </span>
                    <span className="text-xs" style={{ color: "#8A8672" }}>
                      Datum unbekannt
                    </span>
                  </div>
                )}
                {stallEvents.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "#D9CFB8", backgroundColor: "#FFFFFF" }}>
                    <span className="text-sm" style={{ color: "#2B2A26" }}>
                      {ev.type === "stall_umgestallt" ? "Stall: " : "Abschnitt: "}
                      {ev.von} → {ev.nach}
                    </span>
                    <span className="text-xs" style={{ color: "#8A8672" }}>
                      {new Date(ev.date).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "deckbullen" && (
          <>
            <p className="text-xs mb-3" style={{ color: "#8A8672" }}>
              Zeigt, in welchen Zeiträumen ein Deckbulle im selben Stall wie dieses Tier war.
            </p>
            {deckbullenOverlaps.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "#B0A98F" }}>
                Kein Deckbulle war bisher im selben Stall wie dieses Tier.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {deckbullenOverlaps.map((ov, i) => (
                  <div key={i} className="rounded-xl border p-3" style={{ borderColor: "#D9CFB8", backgroundColor: "#FFFFFF" }}>
                    <button
                      type="button"
                      onClick={() => onOpenAnimal(ov.bull)}
                      className="text-sm font-semibold"
                      style={{ color: "#2B2A26" }}
                    >
                      {formatEarTag(ov.bull.earTag) || "ausstehend"}
                      {ov.bull.name ? ` – ${ov.bull.name}` : ""}
                    </button>
                    <div className="text-xs mt-1" style={{ color: "#8A8672" }}>
                      {ov.stall} · {ov.from ? new Date(ov.from).toLocaleDateString("de-DE") : "unbekannt"}
                      {" – "}
                      {ov.to ? new Date(ov.to).toLocaleDateString("de-DE") : "heute"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AbgangsFormular({ animal, onSave, onCancel }) {
  const [grund, setGrund] = useState("");
  const [datum, setDatum] = useState(isoDateKey(new Date()));
  const [todesursache, setTodesursache] = useState("");
  const [todesnotizen, setTodesnotizen] = useState("");
  const [verkaufspreis, setVerkaufspreis] = useState("");
  const [verkaufsgrund, setVerkaufsgrund] = useState("");
  const [verkauftAn, setVerkauftAn] = useState("");

  const canSave = grund && datum && (grund !== "verendet" || todesursache);

  const handleSave = () => {
    if (!canSave) return;
    const data = { abgangsGrund: grund, abgangsDatum: datum };
    if (grund === "verkauft") {
      data.verkaufspreis = verkaufspreis;
      data.verkaufsgrund = verkaufsgrund;
      data.verkauftAn = verkauftAn;
      data.todesursache = "";
      data.todesnotizen = "";
    } else {
      data.verkaufspreis = "";
      data.verkaufsgrund = "";
      data.verkauftAn = "";
      data.todesursache = todesursache;
      data.todesnotizen = todesnotizen;
    }
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)", paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-lg">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-[#F2EBDD] transition"
          aria-label="Abgangsformular schließen"
        >
          <X size={20} className="text-[#2B2A26]" />
        </button>
        <div
          className="w-full bg-white rounded-t-2xl sm:rounded-2xl border-2 overflow-y-auto"
          style={{ borderColor: PASS_BLUE, maxHeight: "min(94vh, 94dvh)" }}
        >
          <p
            className="font-slab text-3xl font-bold px-4 pt-3 pb-2 text-left rounded-t-2xl sm:rounded-t-2xl"
            style={{ color: PASS_BLUE, backgroundColor: "#D4C1D7" }}
          >
            Abgangsformular
          </p>

          <div className="px-5 py-4 rounded-b-2xl" style={{ backgroundColor: "#D4C1D7" }}>
          <p className="text-sm mb-4" style={{ color: "#2B2A26" }}>
            {formatEarTag(animal.earTag) || "ausstehend"}
            {animal.name ? ` – ${animal.name}` : ""}
          </p>

          <label className="block text-sm font-semibold text-[#2B2A26] mb-1">Grund des Abgangs</label>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setGrund("verendet")}
              className="flex-1 py-2.5 rounded-lg font-semibold border-2"
              style={{
                backgroundColor: grund === "verendet" ? "#BB201D" : "#FFFFFF",
                color: grund === "verendet" ? "#FFFFFF" : "#2B2A26",
                borderColor: "#BB201D",
              }}
            >
              Verendet
            </button>
            <button
              type="button"
              onClick={() => setGrund("verkauft")}
              className="flex-1 py-2.5 rounded-lg font-semibold border-2"
              style={{
                backgroundColor: grund === "verkauft" ? "#4C6B3F" : "#FFFFFF",
                color: grund === "verkauft" ? "#FFFFFF" : "#2B2A26",
                borderColor: "#4C6B3F",
              }}
            >
              Verkauft
            </button>
          </div>

          <label className="block text-sm font-semibold text-[#2B2A26] mb-1">Datum des Abgangs</label>
          <input
            type="date"
            value={datum}
            max={isoDateKey(new Date())}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg border text-sm bg-white"
            style={{ borderColor: PASS_BLUE }}
          />

          {grund === "verendet" && (
            <>
              <label className="block text-sm font-semibold text-[#2B2A26] mb-1">Todesursache</label>
              <select
                value={todesursache}
                onChange={(e) => setTodesursache(e.target.value)}
                className="w-full mb-4 px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: PASS_BLUE }}
              >
                <option value="">Bitte wählen…</option>
                <option value="Eingeschläfert">Eingeschläfert</option>
                <option value="Geschossen">Geschossen</option>
                <option value="Natürlich">Natürlich</option>
                <option value="Krankheit">Krankheit</option>
              </select>

              <label className="block text-sm font-semibold text-[#2B2A26] mb-1">Notizen/Grund</label>
              <textarea
                value={todesnotizen}
                onChange={(e) => setTodesnotizen(e.target.value)}
                placeholder="Weitere Angaben (optional)"
                rows={3}
                className="w-full mb-4 px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: PASS_BLUE }}
              />
            </>
          )}

          {grund === "verkauft" && (
            <>
              <label className="block text-sm font-semibold text-[#2B2A26] mb-1">Verkaufspreis (€)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={verkaufspreis}
                onChange={(e) => setVerkaufspreis(e.target.value)}
                placeholder="z. B. 1200"
                className="w-full mb-4 px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: PASS_BLUE }}
              />
              <label className="block text-sm font-semibold text-[#2B2A26] mb-1">Grund des Verkaufs</label>
              <input
                type="text"
                value={verkaufsgrund}
                onChange={(e) => setVerkaufsgrund(e.target.value)}
                placeholder="z. B. Bestandsreduzierung"
                className="w-full mb-4 px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: PASS_BLUE }}
              />
              <label className="block text-sm font-semibold text-[#2B2A26] mb-1">Verkauft an</label>
              <input
                type="text"
                value={verkauftAn}
                onChange={(e) => setVerkauftAn(e.target.value)}
                placeholder="z. B. Hof Meier, Musterstadt"
                className="w-full mb-4 px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: PASS_BLUE }}
              />
            </>
          )}

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-2.5 rounded-lg font-semibold transition"
              style={{
                backgroundColor: canSave ? "#4C6B3F" : "#D9CFB8",
                color: canSave ? "#F2EBDD" : "#8A8672",
                cursor: canSave ? "pointer" : "not-allowed",
              }}
            >
              Abgang speichern
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg font-medium"
              style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
            >
              Abbrechen
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StallbuchView({ animal, onBack }) {
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto" style={{ backgroundColor: "#F9EFE4" }}>
      <div
        className="sticky top-0 z-10 backdrop-blur border-b border-[#D9CFB8] px-5 pt-6 pb-4 flex items-center justify-between gap-3"
        style={{ backgroundColor: "rgba(249, 239, 228, 0.95)" }}
      >
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-[#8A8672]">Stallbuch</p>
          <h1 className="font-slab text-lg font-bold text-[#2B2A26] truncate">
            {formatEarTag(animal.earTag)}
            {animal.name ? ` – ${animal.name}` : ""}
          </h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 transition"
          style={{ color: "#FFFFFF", backgroundColor: "#2B2A26" }}
        >
          Zurück
        </button>
      </div>
      <div className="px-5 py-4 pb-10" />
    </div>
  );
}

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

const GLOVE_PATH =
  "M38.39,0.00 C37.11,-0.06 34.91,0.28 33.74,1.14 C32.58,1.99 31.88,-0.14 31.37,5.12 C30.87,10.38 31.80,31.77 30.71,32.70 C29.62,33.63 26.48,14.99 24.83,10.71 C23.19,6.43 22.32,7.46 20.85,7.01 C19.38,6.57 17.22,7.16 16.02,8.06 C14.82,8.96 13.03,7.24 13.65,12.42 C14.27,17.60 20.60,37.57 19.72,39.15 C18.83,40.73 11.07,24.88 8.34,21.90 C5.61,18.91 4.71,20.63 3.32,21.23 C1.93,21.83 0.47,24.22 0.00,25.50 C-0.47,26.78 -1.53,24.77 0.47,28.91 C2.48,33.05 9.62,44.01 12.04,50.33 C14.45,56.65 13.79,62.24 14.98,66.82 C16.16,71.41 18.48,75.23 19.15,77.82 C19.81,80.41 19.27,81.14 18.96,82.37 C18.64,83.60 17.54,82.81 17.25,85.21 C16.97,87.61 16.68,94.31 17.25,96.78 C17.82,99.24 15.07,99.46 20.66,100.00 C26.26,100.54 45.37,100.25 50.81,100.00 C56.24,99.75 52.72,100.93 53.27,98.48 C53.82,96.03 54.33,88.37 54.12,85.31 C53.92,82.24 52.24,81.91 52.04,80.09 C51.83,78.28 49.13,81.25 52.89,74.41 C56.65,67.57 71.33,45.80 74.60,39.05 C77.87,32.31 73.78,34.91 72.51,33.93 C71.25,32.95 68.55,32.94 67.01,33.18 C65.48,33.41 65.51,33.35 63.32,35.36 C61.12,37.36 55.37,44.58 53.84,45.21 C52.31,45.85 52.94,44.39 54.12,39.15 C55.31,33.90 59.87,18.52 60.95,13.74 C62.02,8.97 61.36,11.66 60.57,10.52 C59.78,9.38 57.82,7.19 56.21,6.92 C54.60,6.65 53.03,4.61 50.90,8.91 C48.77,13.21 44.68,33.29 43.41,32.70 C42.15,32.12 43.65,10.60 43.32,5.40 C42.99,0.21 42.24,2.42 41.42,1.52 C40.60,0.62 39.67,0.06 38.39,0.00 Z";

function GloveIcon({ color = "#E05F37", size = 16 }) {
  return (
    <svg viewBox="0 0 74.6 100" width={size} height={size}>
      <path d={GLOVE_PATH} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CakeIcon({ color = "#007DAE", size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
      <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
      <path d="M2 21h20" />
      <path d="M7 8v3" />
      <path d="M12 8v3" />
      <path d="M17 8v3" />
      <path d="M7 4h.01" />
      <path d="M12 4h.01" />
      <path d="M17 4h.01" />
    </svg>
  );
}

function CrossIcon({ color = "#BB201D", size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d="M5,5 L19,19 M19,5 L5,19" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpDownIcon({ color = "#B97FA8", size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4 L7 15 M4 7 L7 4 L10 7" />
      <path d="M17 20 L17 9 M14 17 L17 20 L20 17" />
    </svg>
  );
}

function SkullIcon({ color = "#BB201D", size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 C7 3 4 6.5 4 11 C4 14 5.5 16 7 17.3 V20 a1 1 0 0 0 1 1 h1 v-2 h1 v2 h4 v-2 h1 v2 h1 a1 1 0 0 0 1 -1 v-2.7 C18.5 16 20 14 20 11 C20 6.5 17 3 12 3 Z" />
      <circle cx="9" cy="11" r="1.6" fill={color} stroke="none" />
      <circle cx="15" cy="11" r="1.6" fill={color} stroke="none" />
      <path d="M11 13.5 h2 l-1 1.5 z" fill={color} stroke="none" />
    </svg>
  );
}

function EuroIcon({ color = "#FBCD49", size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 6.5 C15.5 5 13.5 4.5 12 5 C9 6 7.5 9 7.5 12 C7.5 15 9 18 12 19 C13.5 19.5 15.5 19 17 17.5" />
      <line x1="5" y1="10.5" x2="14" y2="10.5" />
      <line x1="5" y1="13.5" x2="13" y2="13.5" />
    </svg>
  );
}

function HeartIcon({ color = "#E68B9D", size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14 C20.5 12.3 21 10.6 21 9.1 C21 6.6 19 4.6 16.6 4.6 C14.9 4.6 13.5 5.5 12 7.3 C10.5 5.5 9.1 4.6 7.4 4.6 C5 4.6 3 6.6 3 9.1 C3 10.6 3.5 12.3 5 14 C7 16.3 12 20.4 12 20.4 C12 20.4 17 16.3 19 14 Z" />
    </svg>
  );
}

function isoDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d - firstThursday) / (7 * 24 * 60 * 60 * 1000));
}

function nextExpectedHeat(animal) {
  if (!animal.lastHeatDate) return null;
  const [ly, lm, ld] = animal.lastHeatDate.split("-").map(Number);
  const next = new Date(ly, lm - 1, ld);
  next.setDate(next.getDate() + 21);
  return next;
}

const BREEDING_HISTORY_LABELS = {
  brunst: { label: "Brunst eingetragen", color: "#6B6858" },
  besamung: { label: "Besamung", color: "#6B6858" },
  ausgefallen: { label: "Brunst ausgefallen (Trächtigkeit vermutet)", color: "#B3261E" },
  schwangerschaft_direkt: { label: "Trächtigkeit direkt eingetragen (ohne Brunst)", color: "#4C6B3F" },
  schwangerschaft_bestaetigt: { label: "Trächtigkeit bestätigt", color: "#4C6B3F" },
  schwangerschaft_beendet: { label: "Trächtigkeit beendet/abgebrochen", color: "#B3261E" },
  geburt: { label: "Geburt", color: "#4C6B3F" },
};

function dayKey(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function DayAnimalsPicker({ dateLabel, animals, onSelect, onCancel }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl border border-[#D9CFB8] p-5 pb-6 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-slab text-lg font-bold text-[#2B2A26]">{dateLabel}</h2>
          <button type="button" onClick={onCancel} className="p-1 text-[#8A8672] hover:text-[#2B2A26]">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {animals.map((a) => {
            const color = colorForCategory(a.category);
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => onSelect(a)}
                className="flex items-center gap-3 rounded-lg border border-[#D9CFB8] px-3 py-2 text-left hover:bg-[#F9EFE4] transition"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color.bg }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#2B2A26] truncate">
                    {a.name || "Unbenannt"}
                  </span>
                  <span className="block text-xs text-[#8A8672]">
                    {formatEarTag(a.earTag) || "ausstehend"} · {a.category}
                  </span>
                </span>
                <ChevronRight size={16} className="text-[#B0A98F] shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NotesBox() {
  const isAdmin = useContext(AppModeContext) === "admin";
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get("cattle:notes", false);
        if (!cancelled && res?.value) setNotes(res.value);
      } catch (e) {
        // noch keine Mitteilungen gespeichert
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveNotes = async (value) => {
    try {
      await window.storage.set("cattle:notes", value, false);
    } catch (e) {
      // Speichern fehlgeschlagen, wird beim nächsten Änderungsversuch erneut probiert
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-[#D9CFB8] bg-white p-3">
      <label className="block font-slab text-sm font-bold text-[#2B2A26] mb-1">Mitteilungen</label>
      <textarea
        value={notes}
        onChange={(e) => isAdmin && setNotes(e.target.value)}
        onBlur={(e) => isAdmin && saveNotes(e.target.value)}
        readOnly={!isAdmin}
        placeholder="Notizen, Erinnerungen oder Mitteilungen für den Betrieb…"
        rows={3}
        className="w-full px-3 py-2 rounded-lg border bg-white text-[#2B2A26] text-sm focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
        style={{ borderColor: "#9CA3AF" }}
      />
    </section>
  );
}

function ScrollPicker({ items, valueIndex, onChange }) {
  const ref = useRef(null);
  const curIdxRef = useRef(valueIndex);
  const ROW = 32;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    curIdxRef.current = valueIndex;
    el.scrollTop = valueIndex * ROW;
    highlight(valueIndex);

    function highlight(idx) {
      el.querySelectorAll("[data-idx]").forEach((child) => {
        child.style.color = Number(child.dataset.idx) === idx ? "#2B2A26" : "#B0A98F";
        child.style.fontWeight = Number(child.dataset.idx) === idx ? "600" : "400";
        child.style.fontFamily = Number(child.dataset.idx) === idx ? "'Arvo', serif" : "'IBM Plex Sans', sans-serif";
      });
    }

    function selectIndex(idx) {
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      curIdxRef.current = clamped;
      el.scrollTo({ top: clamped * ROW, behavior: "smooth" });
      highlight(clamped);
      onChange(clamped);
    }

    const onWheel = (e) => {
      e.preventDefault();
      selectIndex(curIdxRef.current + (e.deltaY > 0 ? 1 : -1));
    };
    let scrollTimeout;
    const onScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)));
        if (idx !== curIdxRef.current) {
          curIdxRef.current = idx;
          onChange(idx);
        }
        highlight(curIdxRef.current);
      }, 120);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div
      ref={ref}
      className="overflow-y-auto rounded-lg border bg-white"
      style={{ height: 140, width: 96, borderColor: "#D9CFB8", scrollSnapType: "y mandatory" }}
    >
      <div style={{ height: 54 }} />
      {items.map((it, idx) => (
        <div
          key={idx}
          data-idx={idx}
          onClick={() => {
            curIdxRef.current = idx;
            ref.current.scrollTo({ top: idx * 32, behavior: "smooth" });
            onChange(idx);
          }}
          className="flex items-center justify-center text-sm cursor-pointer"
          style={{ height: 32, scrollSnapAlign: "center", color: idx === valueIndex ? "#2B2A26" : "#B0A98F" }}
        >
          {it}
        </div>
      ))}
      <div style={{ height: 54 }} />
    </div>
  );
}

function CalendarNavPicker({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="absolute z-20 rounded-xl border bg-white p-3 shadow-lg"
      style={{ borderColor: "#D9CFB8", top: "110%", right: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function BirthCalendar({ birthsByDate, onOpenAnimal, animals, onUpdateAnimal, onOpenBreedingHistory }) {
  const mobileScroll = useContext(MobileScrollContext);
  const [view, setView] = useState("monat");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [dayPicker, setDayPicker] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [brunstColStart, setBrunstColStart] = useState(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const allCols = buildBrunstColumnsRange(today);
    const idx = allCols.findIndex((col) => today >= col[0] && today <= col[20]);
    const maxStart = Math.max(0, allCols.length - BRUNST_COLS_VISIBLE);
    const centered = (idx >= 0 ? idx : 0) - Math.floor(BRUNST_COLS_VISIBLE / 2);
    return Math.min(Math.max(centered, 0), maxStart);
  });
  useEffect(() => {
    if (view !== "brunft") return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const allCols = buildBrunstColumnsRange(today);
    const idx = allCols.findIndex((col) => today >= col[0] && today <= col[20]);
    const maxStart = Math.max(0, allCols.length - BRUNST_COLS_VISIBLE);
    const centered = (idx >= 0 ? idx : 0) - Math.floor(BRUNST_COLS_VISIBLE / 2);
    setBrunstColStart(Math.min(Math.max(centered, 0), maxStart));
  }, [view]);
  const [collapsed, setCollapsed] = useState(false);

  const breedingAnimals = (animals || []).filter((a) => a.category === "Mutterkühe" || a.category === "Jungrinder");
  const verendeteAnimals = (animals || []).filter((a) => a.category === "Abgänge" && a.abgangsGrund === "verendet" && a.abgangsDatum);
  const verkaufteAnimals = (animals || []).filter((a) => a.category === "Abgänge" && a.abgangsGrund === "verkauft" && a.abgangsDatum);
  const todayRef = new Date();

  const addHistoryEvent = (animal, type, date) => {
    const history = Array.isArray(animal.history) ? animal.history : [];
    onUpdateAnimal(animal.id, { history: [...history, { type, date }] });
  };

  const { year, month: m } = month;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const firstWeekday = (new Date(year, m, 1).getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weekRows = [];
  for (let i = 0; i < cells.length; i += 7) {
    const rowCells = cells.slice(i, i + 7);
    const firstRealDay = rowCells.find((d) => d !== null);
    const kw = firstRealDay ? isoWeekNumber(new Date(year, m, firstRealDay)) : "";
    weekRows.push({ kw, days: rowCells });
  }

  const monthLabel = new Date(year, m, 1).toLocaleDateString("de-DE", { month: "long" });

  const goPrevMonth = () =>
    setMonth((cur) => {
      const nm = cur.month - 1;
      return nm < 0 ? { year: cur.year - 1, month: 11 } : { year: cur.year, month: nm };
    });
  const goNextMonth = () =>
    setMonth((cur) => {
      const nm = cur.month + 1;
      return nm > 11 ? { year: cur.year + 1, month: 0 } : { year: cur.year, month: nm };
    });
  const goPrevYear = () => setMonth((cur) => ({ ...cur, year: cur.year - 1 }));
  const goNextYear = () => setMonth((cur) => ({ ...cur, year: cur.year + 1 }));
  const goPrevDay = () => setSelectedDay((cur) => new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1));
  const goNextDay = () => setSelectedDay((cur) => new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1));

  const handleDayClick = (day) => {
    const key = dayKey(year, m, day);
    const list = birthsByDate[key];
    if (!list || list.length === 0) return;
    if (list.length === 1) {
      onOpenAnimal(list[0]);
    } else {
      setDayPicker({
        label: new Date(year, m, day).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }),
        animals: list,
      });
    }
  };

  const openDayFromMonth = (day) => {
    setSelectedDay(new Date(year, m, day));
    setView("tag");
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString("de-DE", { month: "long" })
  );
  const yearOptions = Array.from({ length: 81 }, (_, i) => year - 40 + i);

  const selYear = selectedDay.getFullYear();
  const selMonth = selectedDay.getMonth();
  const selDay = selectedDay.getDate();
  const selKey = dayKey(selYear, selMonth, selDay);
  const selEvents = birthsByDate[selKey] || [];
  const selLabel = selectedDay.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
    <section className="mb-4 rounded-xl border border-[#D9CFB8] bg-white p-3 relative">
      <div className="flex items-center gap-2 mb-3 relative z-20">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0 flex items-center gap-1"
          aria-label={collapsed ? "Kalender aufklappen" : "Kalender zuklappen"}
        >
          <label className="font-slab text-sm font-bold text-[#2B2A26] cursor-pointer whitespace-nowrap">Kalender</label>
          <ChevronRight
            size={16}
            style={{ color: "#6B6858", transform: collapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.15s" }}
          />
        </button>
        <div className="flex-1 min-w-0 flex rounded-full border border-[#D9CFB8] bg-[#F9EFE4] p-0.5 gap-0.5 overflow-x-auto">
          {[
            ["tag", "Tag"],
            ["monat", "Monat"],
            ["jahr", "Jahr"],
            ["brunft", "Brunst"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className="text-[13px] font-medium rounded-full px-3 py-1.5 whitespace-nowrap shrink-0"
              style={
                view === key
                  ? { backgroundColor: "#2B2A26", color: "#F2EBDD" }
                  : { backgroundColor: "transparent", color: "#6B6858" }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="shrink-0 relative">
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            className="w-8 h-8 rounded-full border bg-white flex items-center justify-center"
            style={{ borderColor: "#D9CFB8" }}
            aria-label="Legende öffnen"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                d="M8.5,9.2 C8.5,6.5 10.2,5.2 12,5.2 C13.9,5.2 15.5,6.6 15.5,8.6 C15.5,10.4 14.4,11.3 13,12.1 C12.2,12.6 12,13 12,14"
                fill="none"
                stroke="#2B2A26"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="17.3" r="1.15" fill="#2B2A26" />
            </svg>
          </button>
          <CalendarNavPicker open={legendOpen} onClose={() => setLegendOpen(false)}>
            {view === "brunft" ? (
              <div className="flex flex-col gap-2.5 text-sm" style={{ color: "#6B6858", minWidth: 200 }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: "#D8E9D6", border: "1px solid #B0BE9B" }} />
                  Nächste erwartete Brunst
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <GloveIcon color="#E05F37" size={16} />
                  </span>
                  Besamung
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <CakeIcon color="#007DAE" size={16} />
                  </span>
                  Voraussichtliches Kalben
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <CrossIcon color="#BB201D" size={16} />
                  </span>
                  Ausgefallene Brunst
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <HeartIcon color="#E68B9D" size={16} />
                  </span>
                  Trächtigkeit bestätigt
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 text-sm" style={{ color: "#6B6858", minWidth: 180 }}>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <CakeIcon color="#007DAE" size={16} />
                  </span>
                  Voraussichtliche Geburt
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <CakeIcon color="#359662" size={16} />
                  </span>
                  Geburt
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }} className="flex items-center justify-center">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: "#D8E9D6", border: "1px solid #B0BE9B" }} />
                  </span>
                  Nächste Brunst
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <ArrowUpDownIcon color="#B97FA8" size={16} />
                  </span>
                  Umgestallt
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <GloveIcon color="#E05F37" size={16} />
                  </span>
                  Besamung
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <SkullIcon color="#BB201D" size={16} />
                  </span>
                  Verendung
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <EuroIcon color="#FBCD49" size={16} />
                  </span>
                  Verkauft
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 16, height: 16 }}>
                    <HeartIcon color="#E68B9D" size={16} />
                  </span>
                  Trächtigkeit bestätigt
                </div>
              </div>
            )}
          </CalendarNavPicker>
        </div>
      </div>

      {!collapsed && (
        <>
      {(legendOpen || yearPickerOpen || monthPickerOpen || tagPickerOpen) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setLegendOpen(false);
            setYearPickerOpen(false);
            setMonthPickerOpen(false);
            setTagPickerOpen(false);
          }}
        />
      )}

      {view === "tag" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <NavArrowButton onClick={goPrevDay} dir="left" />
            <button
              type="button"
              onClick={() => setTagPickerOpen((v) => !v)}
              className="relative font-slab text-base font-bold text-[#2B2A26] px-2 py-1 rounded-lg hover:bg-[#F9EFE4]"
            >
              {selLabel}
              <CalendarNavPicker open={tagPickerOpen} onClose={() => setTagPickerOpen(false)}>
                <input
                  type="date"
                  autoFocus
                  defaultValue={`${selYear}-${pad2(selMonth + 1)}-${pad2(selDay)}`}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [yy, mm, dd] = e.target.value.split("-").map(Number);
                      setSelectedDay(new Date(yy, mm - 1, dd));
                      setTagPickerOpen(false);
                    }
                  }}
                  className="px-2 py-1.5 rounded-lg border text-sm"
                  style={{ borderColor: "#9CA3AF" }}
                />
              </CalendarNavPicker>
            </button>
            <NavArrowButton onClick={goNextDay} dir="right" />
          </div>
          <div className="rounded-xl border p-4 text-center" style={{ borderColor: "#D9CFB8" }}>
            {(() => {
              const dISO = isoDateKey(selectedDay);
              const besamungHere = animalsWithHistoryEventOn(breedingAnimals, ["besamung"], dISO);
              const nextHeatHere = breedingAnimals.filter((a) => {
                const next = nextExpectedHeat(a);
                return next && isoDateKey(next) === dISO;
              });
              const missedHere = animalsWithHistoryEventOn(breedingAnimals, ["ausgefallen"], dISO);
              const pregnancyConfirmedHere = animalsWithHistoryEventOn(breedingAnimals, ["schwangerschaft_bestaetigt", "schwangerschaft_direkt"], dISO);
              const verendetHere = verendeteAnimals.filter((a) => a.abgangsDatum === dISO);
              const verkauftHere = verkaufteAnimals.filter((a) => a.abgangsDatum === dISO);
              const umgestalltHere = animalsWithHistoryEventOn(animals || [], ["stall_umgestallt"], dISO);
              const nothing = selEvents.length === 0 && besamungHere.length === 0 && nextHeatHere.length === 0 && missedHere.length === 0 && pregnancyConfirmedHere.length === 0 && verendetHere.length === 0 && verkauftHere.length === 0 && umgestalltHere.length === 0;
              if (nothing) {
                return (
                  <p className="text-sm" style={{ color: "#B0A98F" }}>
                    Keine Ereignisse an diesem Tag
                  </p>
                );
              }
              return (
                <div className="flex flex-col gap-2">
                  {selEvents.map((a) => (
                    <button
                      key={`geburt-${a.id}`}
                      type="button"
                      onClick={() => onOpenAnimal(a)}
                      className="flex items-center justify-center gap-2 text-sm font-semibold"
                      style={{ color: "#2B2A26" }}
                    >
                      <CakeIcon color="#359662" size={18} />
                      {formatEarTag(a.earTag) || "ausstehend"}
                      {a.name ? ` – ${a.name}` : ""}
                    </button>
                  ))}
                  {besamungHere.map((a) => (
                    <button
                      key={`besamung-${a.id}`}
                      type="button"
                      onClick={() => onOpenAnimal(a)}
                      className="flex items-center justify-center gap-2 text-sm font-semibold"
                      style={{ color: "#2B2A26" }}
                    >
                      <GloveIcon color="#E05F37" size={18} />
                      {formatEarTag(a.earTag) || "ausstehend"}
                      {a.name ? ` – ${a.name}` : ""} · Besamung
                    </button>
                  ))}
                  {nextHeatHere.map((a) => (
                    <button
                      key={`naechste-${a.id}`}
                      type="button"
                      onClick={() => onOpenAnimal(a)}
                      className="flex items-center justify-center gap-2 text-sm font-semibold"
                      style={{ color: "#2B2A26" }}
                    >
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: "#D8E9D6", border: "1px solid #B0BE9B" }} />
                      {formatEarTag(a.earTag) || "ausstehend"}
                      {a.name ? ` – ${a.name}` : ""} · Nächste erwartete Brunst
                    </button>
                  ))}
                  {missedHere.map((a) => (
                    <button
                      key={`ausgefallen-${a.id}`}
                      type="button"
                      onClick={() => onOpenAnimal(a)}
                      className="flex items-center justify-center gap-2 text-sm font-semibold"
                      style={{ color: "#BB201D" }}
                    >
                      <CrossIcon color="#BB201D" size={18} />
                      {formatEarTag(a.earTag) || "ausstehend"}
                      {a.name ? ` – ${a.name}` : ""} · Ausgefallene Brunst
                    </button>
                  ))}
                  {pregnancyConfirmedHere.map((a) => (
                    <button
                      key={`traechtig-${a.id}`}
                      type="button"
                      onClick={() => onOpenAnimal(a)}
                      className="flex items-center justify-center gap-2 text-sm font-semibold"
                      style={{ color: "#2B2A26" }}
                    >
                      <HeartIcon color="#E68B9D" size={18} />
                      {formatEarTag(a.earTag) || "ausstehend"}
                      {a.name ? ` – ${a.name}` : ""} · Trächtigkeit bestätigt
                    </button>
                  ))}
                  {verendetHere.map((a) => (
                    <button
                      key={`verendet-${a.id}`}
                      type="button"
                      onClick={() => onOpenAnimal(a)}
                      className="flex items-center justify-center gap-2 text-sm font-semibold"
                      style={{ color: "#BB201D" }}
                    >
                      <SkullIcon color="#BB201D" size={18} />
                      {formatEarTag(a.earTag) || "ausstehend"}
                      {a.name ? ` – ${a.name}` : ""} · Verendung
                    </button>
                  ))}
                  {verkauftHere.map((a) => (
                    <button
                      key={`verkauft-${a.id}`}
                      type="button"
                      onClick={() => onOpenAnimal(a)}
                      className="flex items-center justify-center gap-2 text-sm font-semibold"
                      style={{ color: "#2B2A26" }}
                    >
                      <EuroIcon color="#FBCD49" size={18} />
                      {formatEarTag(a.earTag) || "ausstehend"}
                      {a.name ? ` – ${a.name}` : ""} · Verkauft
                    </button>
                  ))}
                  {umgestalltHere.map((a) => (
                    <button
                      key={`umgestallt-${a.id}`}
                      type="button"
                      onClick={() => onOpenAnimal(a)}
                      className="flex items-center justify-center gap-2 text-sm font-semibold"
                      style={{ color: "#2B2A26" }}
                    >
                      <ArrowUpDownIcon color="#B97FA8" size={18} />
                      {formatEarTag(a.earTag) || "ausstehend"}
                      {a.name ? ` – ${a.name}` : ""} · Umgestallt
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {view === "monat" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <NavArrowButton onClick={goPrevMonth} dir="left" />
            <button
              type="button"
              onClick={() => setMonthPickerOpen((v) => !v)}
              className="relative font-slab text-base font-bold text-[#2B2A26] capitalize px-2 py-1 rounded-lg hover:bg-[#F9EFE4]"
            >
              {monthLabel} {year}
              <CalendarNavPicker open={monthPickerOpen} onClose={() => setMonthPickerOpen(false)}>
                <div className="flex gap-1.5">
                  <ScrollPicker
                    items={monthOptions}
                    valueIndex={m}
                    onChange={(idx) => setMonth((cur) => ({ ...cur, month: idx }))}
                  />
                  <ScrollPicker
                    items={yearOptions.map(String)}
                    valueIndex={yearOptions.indexOf(year)}
                    onChange={(idx) => setMonth((cur) => ({ ...cur, year: yearOptions[idx] }))}
                  />
                </div>
              </CalendarNavPicker>
            </button>
            <NavArrowButton onClick={goNextMonth} dir="right" />
          </div>

          <div className={`rounded-lg border ${mobileScroll ? "overflow-x-auto" : "overflow-hidden"}`} style={{ borderColor: "#D9CFB8" }}>
            <table className="w-full border-collapse" style={{ tableLayout: mobileScroll ? "auto" : "fixed", minWidth: mobileScroll ? 640 : undefined }}>
              <thead>
                <tr>
                  <th
                    className="text-[10px] uppercase tracking-wide font-semibold py-1.5"
                    style={{ width: "9%", backgroundColor: "#2B2A26", color: "#F2EBDD", borderRight: "1px solid #454340" }}
                  >
                    KW
                  </th>
                  {WEEKDAY_LABELS.map((w) => (
                    <th
                      key={w}
                      className="text-[10px] uppercase tracking-wide font-semibold py-1.5"
                      style={{ backgroundColor: "#2B2A26", color: "#F2EBDD", borderLeft: "1px solid #454340" }}
                    >
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekRows.map((row, ri) => (
                  <tr key={ri}>
                    <td
                      className="text-center align-middle font-slab text-sm font-bold"
                      style={{ backgroundColor: "#F9EFE4", color: "#6B6858", borderTop: "1px solid #D9CFB8", borderRight: "1px solid #D9CFB8" }}
                    >
                      {row.kw}
                    </td>
                    {row.days.map((day, di) => {
                      if (day === null) {
                        return (
                          <td
                            key={di}
                            style={{ backgroundColor: "#F2EBDD", borderTop: "1px solid #D9CFB8", borderLeft: "1px solid #D9CFB8", height: 76 }}
                          />
                        );
                      }
                      const key = dayKey(year, m, day);
                      const events = birthsByDate[key] || [];
                      const hasEvents = events.length > 0;
                      const dISO = isoDateKey(new Date(year, m, day));
                      const besamungAnimals = animalsWithHistoryEventOn(breedingAnimals, ["besamung"], dISO);
                      const calvingAnimals = breedingAnimals.filter((a) => a.expectedCalvingDate === dISO);
                      const nextHeatAnimals = breedingAnimals.filter((a) => {
                        const next = nextExpectedHeat(a);
                        return next && isoDateKey(next) === dISO;
                      });
                      const pregnancyConfirmedAnimals = animalsWithHistoryEventOn(breedingAnimals, ["schwangerschaft_bestaetigt", "schwangerschaft_direkt"], dISO);
                      const verendetAnimals = verendeteAnimals.filter((a) => a.abgangsDatum === dISO);
                      const verkauftAnimals = verkaufteAnimals.filter((a) => a.abgangsDatum === dISO);
                      const umgestallteAnimals = animalsWithHistoryEventOn(animals || [], ["stall_umgestallt"], dISO);
                      const hasAnyEvent = hasEvents || besamungAnimals.length > 0 || calvingAnimals.length > 0 || nextHeatAnimals.length > 0 || pregnancyConfirmedAnimals.length > 0 || verendetAnimals.length > 0 || verkauftAnimals.length > 0 || umgestallteAnimals.length > 0;
                      const today = new Date();
                      const isToday = today.getFullYear() === year && today.getMonth() === m && today.getDate() === day;
                      const isWeekend = di === 5 || di === 6;

                      const rows = [
                        {
                          key: "geburt",
                          list: events,
                          icon: <CakeIcon color="#359662" size={13} />,
                          title: "Geburt",
                        },
                        {
                          key: "naechste",
                          list: nextHeatAnimals,
                          icon: <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#D8E9D6", border: "1px solid #B0BE9B" }} />,
                          title: "Nächste erwartete Brunst",
                        },
                        {
                          key: "besamung",
                          list: besamungAnimals,
                          icon: <GloveIcon color="#E05F37" size={13} />,
                          title: "Besamung",
                        },
                        {
                          key: "kalben",
                          list: calvingAnimals,
                          icon: <CakeIcon color="#007DAE" size={13} />,
                          title: "Voraussichtliches Kalben",
                        },
                        {
                          key: "traechtig",
                          list: pregnancyConfirmedAnimals,
                          icon: <HeartIcon color="#E68B9D" size={13} />,
                          title: "Trächtigkeit bestätigt",
                        },
                        {
                          key: "verendet",
                          list: verendetAnimals,
                          icon: <SkullIcon color="#BB201D" size={13} />,
                          title: "Verendung",
                        },
                        {
                          key: "verkauft",
                          list: verkauftAnimals,
                          icon: <EuroIcon color="#FBCD49" size={13} />,
                          title: "Verkauft",
                        },
                        {
                          key: "umgestallt",
                          list: umgestallteAnimals,
                          icon: <ArrowUpDownIcon color="#B97FA8" size={13} />,
                          title: "Umgestallt",
                        },
                      ].filter((r) => r.list.length > 0);

                      return (
                        <td
                          key={di}
                          onClick={() => openDayFromMonth(day)}
                          className="align-top cursor-pointer p-1 hover:bg-[#F9EFE4] transition"
                          style={{
                            backgroundColor: isWeekend ? "#F9EFE4" : "#FFFFFF",
                            borderTop: "1px solid #D9CFB8",
                            borderLeft: "1px solid #D9CFB8",
                            height: 76,
                            verticalAlign: "top",
                          }}
                        >
                          <span
                            className={`text-[12px] ${isToday ? "font-bold" : ""}`}
                            style={{
                              color: "#2B2A26",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: isToday ? 18 : "auto",
                              height: isToday ? 18 : "auto",
                              borderRadius: isToday ? "50%" : 0,
                              backgroundColor: isToday ? "#2B2A26" : "transparent",
                              color: isToday ? "#F2EBDD" : "#2B2A26",
                            }}
                          >
                            {day}
                          </span>
                          {hasAnyEvent && (
                            <span className="flex flex-col gap-px mt-0.5 w-full">
                              {rows.map((r) => (
                                <span key={r.key} className="flex items-center gap-0.5" title={r.title}>
                                  <span style={{ width: 12, height: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {r.icon}
                                  </span>
                                  <span style={{ fontSize: 10, lineHeight: 1.1 }} className="text-[#2B2A26] truncate">
                                    {r.list.length === 1 ? shortEarTag(r.list[0].earTag) : `×${r.list.length}`}
                                  </span>
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "jahr" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <NavArrowButton onClick={goPrevYear} dir="left" />
            <button
              type="button"
              onClick={() => setYearPickerOpen((v) => !v)}
              className="relative font-slab text-base font-bold text-[#2B2A26] px-2 py-1 rounded-lg hover:bg-[#F9EFE4]"
            >
              {year}
              <CalendarNavPicker open={yearPickerOpen} onClose={() => setYearPickerOpen(false)}>
                <ScrollPicker
                  items={yearOptions.map(String)}
                  valueIndex={yearOptions.indexOf(year)}
                  onChange={(idx) => setMonth((cur) => ({ ...cur, year: yearOptions[idx] }))}
                />
              </CalendarNavPicker>
            </button>
            <NavArrowButton onClick={goNextYear} dir="right" />
          </div>
          <div className={mobileScroll ? "overflow-x-auto" : "-mx-1"}>
            <table className="w-full text-[11px] border-collapse" style={{ tableLayout: mobileScroll ? "auto" : "fixed", minWidth: mobileScroll ? 700 : undefined }}>
              <thead>
                <tr>
                  {MONTH_NAMES.map((mn) => (
                    <th key={mn} className="font-slab text-[11px] font-bold text-left px-1 py-1 truncate" style={{ color: "#2B2A26", borderBottom: "2px solid #2B2A26" }}>
                      {mn.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 31 }, (_, di) => di + 1).map((d) => (
                  <tr key={d}>
                    {MONTH_NAMES.map((mn, mi) => {
                      const dim = new Date(year, mi + 1, 0).getDate();
                      if (d > dim) return <td key={mi} className="px-1.5 py-0.5" />;
                      const wd = (new Date(year, mi, d).getDay() + 6) % 7;
                      const isWeekend = wd >= 5;
                      const key = dayKey(year, mi, d);
                      const events = birthsByDate[key] || [];
                      const dISO = isoDateKey(new Date(year, mi, d));
                      const besamungList = animalsWithHistoryEventOn(breedingAnimals, ["besamung"], dISO);
                      const calvingList = breedingAnimals.filter((a) => a.expectedCalvingDate === dISO);
                      const verendetList = verendeteAnimals.filter((a) => a.abgangsDatum === dISO);
                      const verkauftList = verkaufteAnimals.filter((a) => a.abgangsDatum === dISO);
                      const umgestallteList = animalsWithHistoryEventOn(animals || [], ["stall_umgestallt"], dISO);
                      const pregnancyConfirmedList = breedingAnimals.filter((a) => {
                        const confirmedDate = pregnancyConfirmedDate(a);
                        return confirmedDate && isoDateKey(confirmedDate) === dISO;
                      });
                      const besamungHere = besamungList.length > 0;
                      const calvingHere = calvingList.length > 0;
                      const verendetHere = verendetList.length > 0;
                      const verkauftHere = verkauftList.length > 0;
                      const umgestallteHere = umgestallteList.length > 0;
                      const pregnancyConfirmedHere = pregnancyConfirmedList.length > 0;
                      const sameTypeDot = (
                        <span
                          style={{
                            position: "absolute",
                            top: -2,
                            right: -2,
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            backgroundColor: "#FB9E2B",
                          }}
                        />
                      );
                      return (
                        <td
                          key={mi}
                          onClick={() => {
                            setSelectedDay(new Date(year, mi, d));
                            setView("tag");
                          }}
                          className="px-1 py-0.5 cursor-pointer whitespace-nowrap overflow-visible"
                          style={{ backgroundColor: isWeekend ? "#F9EFE4" : undefined, borderBottom: "1px solid #F2EBDD" }}
                        >
                          {d}
                          {events.length > 0 && (
                            <span style={{ position: "relative", display: "inline-block", marginLeft: 3, verticalAlign: "middle", width: 12, height: 12 }}>
                              <CakeIcon color="#359662" size={12} />
                              {events.length > 1 && sameTypeDot}
                            </span>
                          )}
                          {besamungHere && (
                            <span style={{ position: "relative", display: "inline-block", marginLeft: 3, verticalAlign: "middle", width: 12, height: 12 }} title="Besamung">
                              <GloveIcon color="#E05F37" size={12} />
                              {besamungList.length > 1 && sameTypeDot}
                            </span>
                          )}
                          {calvingHere && (
                            <span style={{ position: "relative", display: "inline-block", marginLeft: 3, verticalAlign: "middle", width: 12, height: 12 }} title="Voraussichtliches Kalben">
                              <CakeIcon color="#007DAE" size={12} />
                              {calvingList.length > 1 && sameTypeDot}
                            </span>
                          )}
                          {verendetHere && (
                            <span style={{ position: "relative", display: "inline-block", marginLeft: 3, verticalAlign: "middle", width: 12, height: 12 }} title="Verendung">
                              <SkullIcon color="#BB201D" size={12} />
                              {verendetList.length > 1 && sameTypeDot}
                            </span>
                          )}
                          {verkauftHere && (
                            <span style={{ position: "relative", display: "inline-block", marginLeft: 3, verticalAlign: "middle", width: 12, height: 12 }} title="Verkauft">
                              <EuroIcon color="#FBCD49" size={12} />
                              {verkauftList.length > 1 && sameTypeDot}
                            </span>
                          )}
                          {umgestallteHere && (
                            <span style={{ position: "relative", display: "inline-block", marginLeft: 3, verticalAlign: "middle", width: 12, height: 12 }} title="Umgestallt">
                              <ArrowUpDownIcon color="#B97FA8" size={12} />
                              {umgestallteList.length > 1 && sameTypeDot}
                            </span>
                          )}
                          {pregnancyConfirmedHere && (
                            <span style={{ position: "relative", display: "inline-block", marginLeft: 3, verticalAlign: "middle", width: 12, height: 12 }} title="Trächtigkeit bestätigt">
                              <HeartIcon color="#E68B9D" size={12} />
                              {pregnancyConfirmedList.length > 1 && sameTypeDot}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "brunft" && (
        <BrunftYearGrid
          animals={breedingAnimals}
          today={todayRef}
          colStart={brunstColStart}
          setColStart={setBrunstColStart}
          onOpenDay={(date) => {
            setSelectedDay(date);
            setView("tag");
          }}
        />
      )}

      {dayPicker && (
        <DayAnimalsPicker
          dateLabel={dayPicker.label}
          animals={dayPicker.animals}
          onSelect={(a) => {
            setDayPicker(null);
            onOpenAnimal(a);
          }}
          onCancel={() => setDayPicker(null)}
        />
      )}
        </>
      )}
    </section>
    </>
  );
}

function pregnancyConfirmedDate(animal) {
  if (!animal.pregnancyConfirmed || !Array.isArray(animal.history)) return null;
  const events = animal.history.filter((ev) => ev.type === "schwangerschaft_bestaetigt" || ev.type === "schwangerschaft_direkt");
  if (events.length === 0) return null;
  const latest = events.reduce((a, b) => (a.date > b.date ? a : b));
  return new Date(latest.date);
}

// Liefert alle Tiere, die an einem bestimmten Datum (ISO, z.B. "2026-08-10") ein
// Historie-Ereignis eines der angegebenen Typen haben. So bleiben auch ältere,
// inzwischen überschriebene Ereignisse (z.B. eine frühere Besamung) im Kalender sichtbar.
function animalsWithHistoryEventOn(animals, types, dISO) {
  return animals.filter((a) => Array.isArray(a.history) && a.history.some((ev) => types.includes(ev.type) && ev.date === dISO));
}

// Baut aus den "stall_umgestallt"-Ereignissen eines Tieres eine Zeitleiste
// [{stall, from, to}], wobei from/to === null "unbekannt" bzw. "bis heute" bedeutet.
function buildStallTimeline(animal) {
  const events = (animal.history || [])
    .filter((ev) => ev.type === "stall_umgestallt")
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const segments = [];
  if (events.length === 0) {
    if (animal.stall) segments.push({ stall: animal.stall, from: null, to: null });
    return segments;
  }
  let currentStall = events[0].von;
  let currentFrom = null;
  events.forEach((ev) => {
    if (currentStall && currentStall !== "Kein Stall") {
      segments.push({ stall: currentStall, from: currentFrom, to: ev.date });
    }
    currentStall = ev.nach;
    currentFrom = ev.date;
  });
  if (currentStall && currentStall !== "Kein Stall") {
    segments.push({ stall: currentStall, from: currentFrom, to: null });
  }
  return segments;
}

// Findet die Überschneidung zweier Stall-Zeiträume (nur wenn gleicher Stall).
function overlapPeriod(segA, segB) {
  if (segA.stall !== segB.stall) return null;
  const todayStr = isoDateKey(new Date());
  let start;
  if (segA.from === null && segB.from === null) start = null;
  else if (segA.from === null) start = segB.from;
  else if (segB.from === null) start = segA.from;
  else start = segA.from > segB.from ? segA.from : segB.from;
  const aEnd = segA.to || todayStr;
  const bEnd = segB.to || todayStr;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start !== null && start > end) return null;
  const ongoing = segA.to === null && segB.to === null;
  return { stall: segA.stall, from: start, to: ongoing ? null : end };
}

function BreedingRow({ animal, onOpenAnimal, onUpdateAnimal, addHistoryEvent, onOpenHistory, onOpenAddCalf }) {
  const isAdmin = useContext(AppModeContext) === "admin";
  const [openPanel, setOpenPanel] = useState(null); // "brunst" | "besamung" | "confirm" | "status" | null
  const todayISO = isoDateKey(new Date());
  const [brunstDate, setBrunstDate] = useState(animal.lastHeatDate || "");
  const [besamungDate, setBesamungDate] = useState(animal.lastInseminationDate || "");
  const [directPregnancyDate, setDirectPregnancyDate] = useState(todayISO);

  const next = nextExpectedHeat(animal);

  const saveBrunst = () => {
    if (!brunstDate) return;
    onUpdateAnimal(animal.id, {
      lastHeatDate: brunstDate,
      lastMissedHeatDate: "",
      expectedCalvingDate: "",
      pregnancyConfirmed: false,
      pregnancyDirect: false,
    });
    addHistoryEvent(animal, "brunst", brunstDate);
    setOpenPanel(null);
  };
  const saveBesamung = () => {
    if (!besamungDate) return;
    onUpdateAnimal(animal.id, { lastInseminationDate: besamungDate });
    addHistoryEvent(animal, "besamung", besamungDate);
    setOpenPanel(null);
  };
  const confirmAusgefallen = () => {
    const missedDate = isoDateKey(next);
    const baseDateStr = animal.lastInseminationDate || animal.lastHeatDate;
    const [by, bm, bd] = baseDateStr.split("-").map(Number);
    const calving = new Date(by, bm - 1, bd);
    calving.setDate(calving.getDate() + 283);
    onUpdateAnimal(animal.id, { lastMissedHeatDate: missedDate, expectedCalvingDate: isoDateKey(calving), pregnancyDirect: false });
    addHistoryEvent(animal, "ausgefallen", missedDate);
    setOpenPanel(null);
  };
  const enterPregnancyDirect = () => {
    if (!directPregnancyDate) return;
    onUpdateAnimal(animal.id, {
      lastMissedHeatDate: directPregnancyDate,
      expectedCalvingDate: "",
      pregnancyConfirmed: true,
      pregnancyDirect: true,
    });
    addHistoryEvent(animal, "schwangerschaft_direkt", directPregnancyDate);
    setOpenPanel(null);
  };
  const confirmPregnancy = () => {
    onUpdateAnimal(animal.id, { pregnancyConfirmed: true });
    addHistoryEvent(animal, "schwangerschaft_bestaetigt", todayISO);
  };
  const endPregnancy = () => {
    onUpdateAnimal(animal.id, { lastMissedHeatDate: "", expectedCalvingDate: "", pregnancyConfirmed: false, pregnancyDirect: false });
    addHistoryEvent(animal, "schwangerschaft_beendet", todayISO);
    setOpenPanel(null);
  };
  const addBirth = () => {
    const wasPregnant = !!animal.lastMissedHeatDate;
    onUpdateAnimal(animal.id, {
      lastMissedHeatDate: "",
      expectedCalvingDate: "",
      pregnancyConfirmed: false,
      pregnancyDirect: false,
      lastHeatDate: "",
    });
    if (wasPregnant) addHistoryEvent(animal, "schwangerschaft_beendet", todayISO);
    addHistoryEvent(animal, "geburt", todayISO);
    setOpenPanel(null);
    if (onOpenAddCalf) onOpenAddCalf(animal);
  };

  const isPregnant = !!animal.lastMissedHeatDate;

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "#D9CFB8", backgroundColor: "#FFFFFF" }}>
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <button type="button" onClick={() => onOpenHistory(animal)} className="flex items-center gap-2 text-sm font-semibold text-left" style={{ color: "#2B2A26" }}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorForCategory(animal.category).bg }} />
          {formatEarTag(animal.earTag) || "ausstehend"}
          {animal.name ? ` – ${animal.name}` : ""}
        </button>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {isAdmin && (isPregnant ? (
            <>
              <button type="button" onClick={() => setOpenPanel(openPanel === "status" ? null : "status")} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
                Schwangerschafts-Status
              </button>
              <button type="button" onClick={() => setOpenPanel(openPanel === "brunst" ? null : "brunst")} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
                + Brunst hinzufügen
              </button>
            </>
          ) : (
            <>
              {!animal.lastHeatDate && (
                <button type="button" onClick={() => setOpenPanel(openPanel === "brunst" ? null : "brunst")} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
                  + Brunst
                </button>
              )}
              {animal.lastHeatDate && (
                <button type="button" onClick={() => setOpenPanel(openPanel === "confirm" ? null : "confirm")} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
                  + Brunst ausgefallen
                </button>
              )}
              <button type="button" onClick={() => setOpenPanel(openPanel === "besamung" ? null : "besamung")} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
                + Besamung
              </button>
              {!animal.lastHeatDate && (
                <button type="button" onClick={() => setOpenPanel(openPanel === "confirmDirect" ? null : "confirmDirect")} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
                  + Trächtigkeit eintragen
                </button>
              )}
            </>
          ))}
        </div>
      </div>

      {openPanel === "brunst" && (
        <div className="flex items-center gap-2 mb-2">
          <input type="date" value={brunstDate} max={todayISO} onChange={(e) => setBrunstDate(e.target.value)} className="px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: "#9CA3AF" }} />
          <button type="button" onClick={saveBrunst} className="text-xs font-semibold rounded-lg px-3 py-1.5" style={{ backgroundColor: "#394146", color: "#F7EFE9" }}>
            Brunst speichern
          </button>
        </div>
      )}
      {openPanel === "confirm" && (
        <div className="flex flex-col items-start gap-2 mb-2">
          <span className="text-xs" style={{ color: "#2B2A26" }}>
            Bist du sicher, dass die Brunst bei diesem Tier ausgefallen ist? Das deutet auf eine erfolgreiche Trächtigkeit hin.
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={confirmAusgefallen} className="text-xs font-semibold rounded-lg px-3 py-1.5" style={{ backgroundColor: "#394146", color: "#F7EFE9" }}>
              Ja, sicher
            </button>
            <button type="button" onClick={() => setOpenPanel(null)} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {openPanel === "confirmDirect" && (
        <div className="flex flex-col items-start gap-2 mb-2">
          <span className="text-xs" style={{ color: "#2B2A26" }}>
            Trächtigkeit ohne gemeldete Brunst eintragen? Sie gilt dann direkt als bestätigt. Der Kalbetermin ist in dem Fall unbekannt.
          </span>
          <label className="text-xs" style={{ color: "#6B6858" }}>
            Bestätigt am:
            <input
              type="date"
              value={directPregnancyDate}
              max={todayISO}
              onChange={(e) => setDirectPregnancyDate(e.target.value)}
              className="ml-2 text-xs px-2 py-1 rounded-lg border"
              style={{ borderColor: "#D9CFB8" }}
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={enterPregnancyDirect} className="text-xs font-semibold rounded-lg px-3 py-1.5" style={{ backgroundColor: "#394146", color: "#F7EFE9" }}>
              Ja, eintragen
            </button>
            <button type="button" onClick={() => setOpenPanel(null)} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {openPanel === "besamung" && (
        <div className="flex items-center gap-2 mb-2">
          <input type="date" value={besamungDate} max={todayISO} onChange={(e) => setBesamungDate(e.target.value)} className="px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: "#9CA3AF" }} />
          <button type="button" onClick={saveBesamung} className="text-xs font-semibold rounded-lg px-3 py-1.5" style={{ backgroundColor: "#394146", color: "#F7EFE9" }}>
            Besamung speichern
          </button>
        </div>
      )}
      {openPanel === "status" && (
        <div className="flex flex-col items-start gap-2 mb-2">
          <span className="text-xs font-semibold" style={{ color: animal.pregnancyConfirmed ? "#4A6448" : "#BB201D" }}>
            {animal.pregnancyConfirmed ? "Trächtigkeit bestätigt" : "Trächtig (unbestätigt)"} · Erwartetes Kalben:{" "}
            {animal.expectedCalvingDate ? new Date(animal.expectedCalvingDate).toLocaleDateString("de-DE") : "unbekannt"}
          </span>
          <div className="flex gap-2 flex-wrap">
            {!animal.pregnancyConfirmed && (
              <button type="button" onClick={confirmPregnancy} className="text-xs font-semibold rounded-lg px-3 py-1.5" style={{ backgroundColor: "#394146", color: "#F7EFE9" }}>
                Trächtigkeit bestätigen
              </button>
            )}
            <button type="button" onClick={endPregnancy} className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
              Trächtigkeit beenden
            </button>
            {animal.pregnancyConfirmed && (
              <button type="button" onClick={addBirth} className="text-xs font-semibold rounded-lg px-3 py-1.5" style={{ backgroundColor: "#394146", color: "#F7EFE9" }}>
                Geburt eintragen
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {animal.lastHeatDate && (
          <div className="flex items-center justify-between text-xs" style={{ color: "#6B6858" }}>
            <span>Letzte Brunst: {new Date(animal.lastHeatDate).toLocaleDateString("de-DE")}</span>
            <span>
              {animal.expectedCalvingDate
                ? `Erwartetes Kalben: ${new Date(animal.expectedCalvingDate).toLocaleDateString("de-DE")}`
                : next
                ? `Nächste erwartet: ${next.toLocaleDateString("de-DE")}`
                : ""}
            </span>
          </div>
        )}
        {isPregnant && !animal.lastHeatDate && (
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "#4A6448" }}>Trächtigkeit eingetragen (ohne Brunst): {new Date(animal.lastMissedHeatDate).toLocaleDateString("de-DE")}</span>
            <span style={{ color: "#4A6448" }}>Erwartetes Kalben: unbekannt</span>
          </div>
        )}
        {animal.lastMissedHeatDate && animal.lastHeatDate && (
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "#BB201D" }}>Brunst ausgefallen: {new Date(animal.lastMissedHeatDate).toLocaleDateString("de-DE")}</span>
            <span style={{ color: animal.pregnancyConfirmed ? "#4A6448" : "#BB201D" }}>
              {animal.pregnancyConfirmed ? "Trächtigkeit bestätigt" : "Trächtigkeit unbestätigt"}
            </span>
          </div>
        )}
        {animal.lastInseminationDate && (
          <div className="text-xs" style={{ color: "#6B6858" }}>
            Letzte Besamung: {new Date(animal.lastInseminationDate).toLocaleDateString("de-DE")}
          </div>
        )}
        {!animal.lastHeatDate && !animal.lastInseminationDate && !isPregnant && (
          <p className="text-xs" style={{ color: "#B0A98F" }}>
            Noch keine Brunst oder Besamung eingetragen.
          </p>
        )}
      </div>
    </div>
  );
}

const DEFAULT_STAELLE = [
  "Mutterkuh groß",
  "Mutterkuh klein",
  "Kälberbucht",
  "Krankenbucht",
  "Rinderabteil 1",
  "Rinderabteil 2",
  "Rinderabteil 3",
  "Rinderabteil 4",
  "Rinderabteil 5",
  "Rinderabteil 6",
];

function useStaelle() {
  const [staelle, setStaelle] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let current = [];
      try {
        const res = await window.storage.get("cattle:staelle", false);
        if (res?.value) current = JSON.parse(res.value);
      } catch (e) {
        // noch keine Ställe gespeichert
      }
      const existingNames = current.map((s) => s.name);
      const missing = DEFAULT_STAELLE.filter((name) => !existingNames.includes(name));
      const complete = [...current, ...missing.map((name) => ({ id: generateId(), name, isDefault: true }))];
      if (!cancelled) {
        setStaelle(complete);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { staelle, loaded };
}

function AnimalsByStallView({ animals, color, onOpenAnimal, showParents, showGender }) {
  const { staelle, loaded } = useStaelle();
  if (!loaded) return null;

  const grouped = staelle
    .map((s) => ({ name: s.name, animals: animals.filter((a) => a.stall === s.name) }))
    .filter((g) => g.animals.length > 0);
  const ohneStall = animals.filter((a) => !a.stall || !staelle.some((s) => s.name === a.stall));

  if (grouped.length === 0 && ohneStall.length === 0) {
    return <p className="text-sm text-[#B0A98F] italic px-0.5">Keine Tiere in diesem Abschnitt.</p>;
  }

  return (
    <>
      {grouped.map((g) => (
        <SectionTable
          key={g.name}
          title={g.name}
          color={color}
          animals={g.animals}
          onOpenAnimal={onOpenAnimal}
          showParents={showParents}
          showGender={showGender}
        />
      ))}
      {ohneStall.length > 0 && (
        <SectionTable
          title="Ohne Stall"
          color={FALLBACK_COLOR}
          animals={ohneStall}
          onOpenAnimal={onOpenAnimal}
          showParents={showParents}
          showGender={showGender}
        />
      )}
    </>
  );
}

function BrunstVorschauCard({ animals, onOpenAnimal, onUpdateAnimal, addHistoryEvent, onOpenHistory, onShowAll, onOpenAddCalf }) {
  const withDate = animals.filter((a) => a.lastHeatDate);
  withDate.sort((a, b) => nextExpectedHeat(a) - nextExpectedHeat(b));
  const top3 = withDate.slice(0, 3);

  return (
    <section className="mb-4 rounded-xl border border-[#D9CFB8] bg-white p-3">
      <p className="font-slab text-sm font-bold text-[#2B2A26] mb-1">Brunstliste</p>
      <p className="text-xs mb-2" style={{ color: "#8A8672" }}>
        Zeigt die 3 Kühe mit der am nächsten bevorstehenden Brunst.
      </p>
      {top3.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "#B0A98F" }}>
          Noch keine Brunst eingetragen.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {top3.map((a) => (
            <BreedingRow key={a.id} animal={a} onOpenAnimal={onOpenAnimal} onUpdateAnimal={onUpdateAnimal} addHistoryEvent={addHistoryEvent} onOpenHistory={onOpenHistory} onOpenAddCalf={onOpenAddCalf} />
          ))}
        </div>
      )}
      <button type="button" onClick={onShowAll} className="mt-2.5 text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
        Gesamte Brunstliste anzeigen
      </button>
    </section>
  );
}

function BrunstlisteView({ animals, onOpenAnimal, onUpdateAnimal, addHistoryEvent, onOpenHistory, onBack, onOpenAddCalf }) {
  const [breedingSortBy, setBreedingSortBy] = useState("naechste-brunst");
  const [breedingSearch, setBreedingSearch] = useState("");

  const sorted = animals.slice().sort((a, b) => {
    let av, bv;
    if (breedingSortBy === "letzte-brunst") {
      av = a.lastHeatDate ? new Date(a.lastHeatDate) : null;
      bv = b.lastHeatDate ? new Date(b.lastHeatDate) : null;
    } else if (breedingSortBy === "erwartetes-kalb") {
      av = a.expectedCalvingDate ? new Date(a.expectedCalvingDate) : null;
      bv = b.expectedCalvingDate ? new Date(b.expectedCalvingDate) : null;
    } else if (breedingSortBy === "besamung") {
      av = a.lastInseminationDate ? new Date(a.lastInseminationDate) : null;
      bv = b.lastInseminationDate ? new Date(b.lastInseminationDate) : null;
    } else if (breedingSortBy === "traechtigkeit") {
      av = pregnancyConfirmedDate(a);
      bv = pregnancyConfirmedDate(b);
    } else {
      av = nextExpectedHeat(a);
      bv = nextExpectedHeat(b);
    }
    if (av && bv) return av - bv;
    if (av) return -1;
    if (bv) return 1;
    return 0;
  });
  const searchTerm = breedingSearch.trim().toLowerCase();
  const filtered = searchTerm
    ? sorted.filter((a) => {
        const tag = cleanEarTag(a.earTag || "").toLowerCase();
        const name = (a.name || "").toLowerCase();
        return tag.includes(searchTerm.replace(/\s/g, "")) || name.includes(searchTerm);
      })
    : sorted;

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto" style={{ backgroundColor: "#F9EFE4" }}>
      <div
        className="sticky top-0 z-10 backdrop-blur border-b border-[#D9CFB8] px-5 pt-6 pb-4 flex items-center justify-between gap-3"
        style={{ backgroundColor: "rgba(249, 239, 228, 0.95)" }}
      >
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-[#8A8672]">Übersicht</p>
          <h1 className="font-slab text-lg font-bold text-[#2B2A26] truncate">Brunstliste</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setBreedingSearch("");
            onBack();
          }}
          className="shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 transition"
          style={{ color: "#FFFFFF", backgroundColor: "#2B2A26" }}
        >
          Zurück
        </button>
      </div>
      <div className="px-5 py-4 pb-10">
        <p className="text-xs mb-3" style={{ color: "#8A8672" }}>
          Letzte Brunst je Tier eintragen/ändern.
        </p>
        <input
          type="text"
          value={breedingSearch}
          onChange={(e) => setBreedingSearch(e.target.value)}
          placeholder="Suche nach Ohrmarke oder Name..."
          className="w-full mb-3 px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: "#D9CFB8" }}
        />
        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs" style={{ color: "#6B6858" }}>
            Sortieren nach:
          </label>
          <select
            value={breedingSortBy}
            onChange={(e) => setBreedingSortBy(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg border"
            style={{ borderColor: "#D9CFB8" }}
          >
            <option value="letzte-brunst">Letzte Brunst</option>
            <option value="naechste-brunst">Nächste erwartete Brunst</option>
            <option value="erwartetes-kalb">Erwartetes Kalb</option>
            <option value="besamung">Besamung</option>
            <option value="traechtigkeit">Bestätigte Trächtigkeit</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "#B0A98F" }}>
            {searchTerm ? "Kein Tier gefunden." : "Noch keine Mutterkühe oder Jungrinder erfasst."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((a) => (
              <BreedingRow
                key={a.id}
                animal={a}
                onOpenAnimal={onOpenAnimal}
                onUpdateAnimal={onUpdateAnimal}
                addHistoryEvent={addHistoryEvent}
                onOpenHistory={onOpenHistory}
                onOpenAddCalf={onOpenAddCalf}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StaelleView({ onBack }) {
  const isAdmin = useContext(AppModeContext) === "admin";
  const [staelle, setStaelle] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let current = [];
      try {
        const res = await window.storage.get("cattle:staelle", false);
        if (res?.value) current = JSON.parse(res.value);
      } catch (e) {
        // noch keine Ställe gespeichert
      }
      const existingNames = current.map((s) => s.name);
      const missing = DEFAULT_STAELLE.filter((name) => !existingNames.includes(name));
      const withNewDefaults = [...current, ...missing.map((name) => ({ id: generateId(), name, isDefault: true }))];
      const complete = withNewDefaults.map((s) => (DEFAULT_STAELLE.includes(s.name) ? { ...s, isDefault: true } : s));
      const changed = missing.length > 0 || complete.some((s, i) => s.isDefault !== withNewDefaults[i].isDefault);
      if (!cancelled) {
        setStaelle(complete);
        setLoaded(true);
      }
      if (changed) {
        try {
          await window.storage.set("cattle:staelle", JSON.stringify(complete), false);
        } catch (e) {
          // Speichern fehlgeschlagen, wird beim nächsten Änderungsversuch erneut probiert
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistStaelle = async (next) => {
    setStaelle(next);
    try {
      await window.storage.set("cattle:staelle", JSON.stringify(next), false);
    } catch (e) {
      // Speichern fehlgeschlagen, wird beim nächsten Änderungsversuch erneut probiert
    }
  };

  const addStall = () => {
    const name = newName.trim();
    if (!name) return;
    persistStaelle([...staelle, { id: generateId(), name }]);
    setNewName("");
    setAdding(false);
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditDraft(s.name);
  };

  const saveEdit = () => {
    const name = editDraft.trim();
    if (!name) return;
    persistStaelle(staelle.map((s) => (s.id === editingId ? { ...s, name } : s)));
    setEditingId(null);
  };

  const deleteStall = (id) => {
    persistStaelle(staelle.filter((s) => s.id !== id));
  };

  if (!loaded) return null;

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto" style={{ backgroundColor: "#F9EFE4" }}>
      <div
        className="sticky top-0 z-10 backdrop-blur border-b border-[#D9CFB8] px-5 pt-6 pb-4 flex items-center justify-between gap-3"
        style={{ backgroundColor: "rgba(249, 239, 228, 0.95)" }}
      >
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-[#8A8672]">Übersicht</p>
          <h1 className="font-slab text-lg font-bold text-[#2B2A26] truncate">Ställe</h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 transition"
          style={{ color: "#FFFFFF", backgroundColor: "#2B2A26" }}
        >
          Zurück zur Hauptseite
        </button>
      </div>
      <div className="px-5 py-4 pb-10">
        <p className="text-xs mb-3" style={{ color: "#8A8672" }}>
          Verwalte hier die Namen deiner Ställe.
        </p>
        {staelle.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "#B0A98F" }}>
            Noch keine Ställe angelegt.
          </p>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {staelle.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border p-2.5" style={{ borderColor: "#D9CFB8", backgroundColor: "#FFFFFF" }}>
                {editingId === s.id ? (
                  <input
                    type="text"
                    value={editDraft}
                    autoFocus
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="flex-1 text-sm px-2 py-1 rounded-lg border mr-2"
                    style={{ borderColor: "#D9CFB8" }}
                  />
                ) : isAdmin ? (
                  <button type="button" onClick={() => startEdit(s)} className="text-sm font-semibold text-left flex-1" style={{ color: "#2B2A26" }}>
                    {s.name}
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-left flex-1" style={{ color: "#2B2A26" }}>
                    {s.name}
                  </span>
                )}
                  {s.isDefault || !isAdmin ? (
                    <span className="text-[10px] uppercase tracking-wide px-2" style={{ color: "#B0A98F" }}>
                      {s.isDefault ? "Bestand" : ""}
                    </span>
                  ) : (
                    <button type="button" onClick={() => deleteStall(s.id)} className="p-1.5 rounded-lg hover:bg-[#F9EFE4]" aria-label="Stall löschen">
                      <Trash2 size={16} style={{ color: "#BB201D" }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {isAdmin && (adding ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStall()}
                placeholder="Name des Stalls"
                className="flex-1 text-sm px-2 py-1.5 rounded-lg border"
                style={{ borderColor: "#D9CFB8" }}
              />
              <button type="button" onClick={addStall} className="text-xs font-semibold rounded-lg px-3 py-1.5" style={{ backgroundColor: "#394146", color: "#F7EFE9" }}>
                Speichern
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                }}
                className="text-xs font-semibold rounded-lg px-2.5 py-1.5"
                style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "#F9EFE4", color: "#6B6858" }}>
              + Stall hinzufügen
            </button>
          ))}
      </div>
    </div>
  );
}

const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const BRUNST_COLS_VISIBLE = 5;

function buildBrunstColumnsRange(today) {
  const fromYear = today.getFullYear() - 1;
  const toYear = today.getFullYear() + 2;
  let d = new Date(fromYear, 0, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  const rangeEnd = new Date(toYear, 11, 31);
  const columns = [];
  let colStart = new Date(d);
  while (colStart <= rangeEnd) {
    const colDates = [];
    for (let i = 0; i < 21; i++) {
      const dt = new Date(colStart);
      dt.setDate(dt.getDate() + i);
      colDates.push(dt);
    }
    columns.push(colDates);
    colStart = new Date(colStart);
    colStart.setDate(colStart.getDate() + 21);
  }
  return columns;
}

function BrunftYearGrid({ animals, today, colStart, setColStart, onOpenDay }) {
  const allColumns = useMemo(() => buildBrunstColumnsRange(today), [today.getFullYear()]);
  const maxStart = Math.max(0, allColumns.length - BRUNST_COLS_VISIBLE);
  const clampedStart = Math.min(Math.max(colStart, 0), maxStart);
  const columns = allColumns.slice(clampedStart, clampedStart + BRUNST_COLS_VISIBLE);

  const windows = {};
  const besamungMap = {};
  const calvingMap = {};
  const missedMap = {};
  const pregnancyConfirmedMap = {};
  animals.forEach((a) => {
    if (a.lastHeatDate) {
      const next = nextExpectedHeat(a);
      const key = isoDateKey(next);
      (windows[key] = windows[key] || []).push(a);
    }
    if (a.lastInseminationDate) (besamungMap[a.lastInseminationDate] = besamungMap[a.lastInseminationDate] || []).push(a);
    if (a.expectedCalvingDate) (calvingMap[a.expectedCalvingDate] = calvingMap[a.expectedCalvingDate] || []).push(a);
    if (a.lastMissedHeatDate) (missedMap[a.lastMissedHeatDate] = missedMap[a.lastMissedHeatDate] || []).push(a);
    const confirmedDate = pregnancyConfirmedDate(a);
    if (confirmedDate) {
      const ck = isoDateKey(confirmedDate);
      (pregnancyConfirmedMap[ck] = pregnancyConfirmedMap[ck] || []).push(a);
    }
  });

  const first = columns[0][0];
  const last = columns[columns.length - 1][20];
  const yearLabel = first.getFullYear() === last.getFullYear() ? String(first.getFullYear()) : `${first.getFullYear()}–${last.getFullYear()}`;
  const monthShortLabel = (d) => MONTH_NAMES[d.getMonth()].slice(0, 3) + " " + d.getFullYear();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <NavArrowButton onClick={() => setColStart((c) => c - 2)} dir="left" />
        <span className="font-slab text-base font-bold text-[#2B2A26]">{yearLabel}</span>
        <NavArrowButton onClick={() => setColStart((c) => c + 2)} dir="right" />
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="text-[11px] border-collapse w-full">
          <thead>
            <tr>
              {columns.map((col, i) => {
                const l1 = monthShortLabel(col[0]);
                const l2 = monthShortLabel(col[20]);
                return (
                  <th key={i} className="font-slab text-[11px] font-bold text-left px-1.5 py-1" style={{ color: "#2B2A26", borderBottom: "2px solid #2B2A26" }}>
                    {l1}
                    {l2 !== l1 && (
                      <>
                        <br />
                        {l2}
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 21 }, (_, row) => (
              <tr key={row}>
                {columns.map((col, ci) => {
                  const date = col[row];
                  const key = isoDateKey(date);
                  const inWindow = windows[key];
                  const besamungHere = besamungMap[key];
                  const calvingHere = calvingMap[key];
                  const missedHere = missedMap[key];
                  const pregnancyConfirmedHere = pregnancyConfirmedMap[key];
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const titleParts = [];
                  if (inWindow) titleParts.push("Brunst erwartet: " + inWindow.map((c) => c.earTag).join(", "));
                  if (besamungHere) titleParts.push("Besamung: " + besamungHere.map((c) => c.earTag).join(", "));
                  if (calvingHere) titleParts.push("Kalben erwartet: " + calvingHere.map((c) => c.earTag).join(", "));
                  if (missedHere) titleParts.push("Brunst ausgefallen: " + missedHere.map((c) => c.earTag).join(", "));
                  if (pregnancyConfirmedHere) titleParts.push("Trächtigkeit bestätigt: " + pregnancyConfirmedHere.map((c) => c.earTag).join(", "));
                  return (
                    <td
                      key={ci}
                      onClick={() => onOpenDay(date)}
                      title={titleParts.join(" · ")}
                      className="px-1.5 py-0.5 cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: inWindow ? "#D8E9D6" : isWeekend ? "#F7EFE9" : undefined,
                        borderBottom: "1px solid #F2EBDD",
                      }}
                    >
                      <span style={{ color: "#B0A98F", fontSize: 9 }}>{WEEKDAYS_SHORT[row % 7]}</span>{" "}
                      <span className="font-slab font-bold">
                        {pad2(date.getDate())}.{pad2(date.getMonth() + 1)}.
                      </span>
                      {besamungHere && (
                        <span style={{ display: "inline-block", width: 12, height: 12, verticalAlign: "middle", marginLeft: 2 }}>
                          <GloveIcon color="#E05F37" size={12} />
                        </span>
                      )}
                      {calvingHere && (
                        <span style={{ display: "inline-block", width: 12, height: 12, verticalAlign: "middle", marginLeft: 2 }}>
                          <CakeIcon color="#007DAE" size={12} />
                        </span>
                      )}
                      {missedHere && (
                        <span style={{ display: "inline-block", width: 12, height: 12, verticalAlign: "middle", marginLeft: 2 }}>
                          <CrossIcon color="#BB201D" size={12} />
                        </span>
                      )}
                      {pregnancyConfirmedHere && (
                        <span style={{ display: "inline-block", width: 12, height: 12, verticalAlign: "middle", marginLeft: 2 }}>
                          <HeartIcon color="#E68B9D" size={12} />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NavArrowButton({ onClick, dir }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-9 h-9 rounded-lg border bg-white flex items-center justify-center"
      style={{ borderColor: "#D9CFB8" }}
      aria-label={dir === "left" ? "Zurück" : "Weiter"}
    >
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path
          d={dir === "left" ? "M15,5 L8,12 L15,19" : "M9,5 L16,12 L9,19"}
          fill="none"
          stroke="#2B2A26"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}


// ===== Adress-Navigation (URL mit #/...) =====
// Jede Seite der App bekommt eine eigene Adresse, z. B.
//   #/                       Startseite
//   #/liste/kaelber          Abschnitt "Kälber"
//   #/tier/<id>              Rinderpass
//   #/tier/<id>/historie/nachkommen
//   #/tier/<id>/stallbuch
//   #/tier/<id>/bearbeiten   (auch: /registrieren, /abgang)
//   #/neu/kaelber            Tier hinzufügen
//   #/stammbaum, #/staelle, #/brunstliste
// Dadurch funktionieren Zurück-Taste, Neuladen und Lesezeichen.
const ROUTE_LIST_SLUGS = {
  Gesamt: "gesamt",
  "Mutterkühe": "mutterkuehe",
  "Kälber": "kaelber",
  Jungrinder: "jungrinder",
  Deckbullen: "deckbullen",
  "Abgänge": "abgaenge",
  Unregistriert: "unregistriert",
};
const ROUTE_SLUG_TO_LIST = Object.fromEntries(Object.entries(ROUTE_LIST_SLUGS).map(([k, v]) => [v, k]));
const ROUTE_FORM_SUFFIXES = ["bearbeiten", "registrieren", "abgang"];

function currentRouteHash() {
  const h = window.location.hash || "";
  return h === "" || h === "#" ? "#/" : h;
}

function parseRoute(hash) {
  const [pathPart, queryPart] = hash.replace(/^#\/?/, "").split("?");
  const parts = pathPart.split("/").filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch (e) { return p; }
  });
  const params = new URLSearchParams(queryPart || "");
  return { parts, params };
}

// Formular-Adressen: beim Verlassen wird der Eintrag ersetzt statt ein neuer angelegt
function isFormRoute(hash) {
  const { parts } = parseRoute(hash);
  return parts[0] === "neu" || (parts[0] === "tier" && ROUTE_FORM_SUFFIXES.includes(parts[2]));
}

// Reiterwechsel in der Historie gilt nicht als neue Seite
function sameRoutePage(a, b) {
  const pa = parseRoute(a).parts;
  const pb = parseRoute(b).parts;
  return pa[0] === "tier" && pb[0] === "tier" && pa[1] === pb[1] && pa[2] === "historie" && pb[2] === "historie";
}

function RinderbestandApp() {
  const [animals, setAnimals] = useState([]);
  const animalsRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [presetCategory, setPresetCategory] = useState(null);
  const [presetMotherEarTag, setPresetMotherEarTag] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formRegistering, setFormRegistering] = useState(false);
  const [passAnimal, setPassAnimal] = useState(null);
  const [historieAnimal, setHistorieAnimal] = useState(null);
  const [historieTab, setHistorieTab] = useState("brunsthistorie");
  const [historieReturnTo, setHistorieReturnTo] = useState(null);
  const [historieReturnToBrunstliste, setHistorieReturnToBrunstliste] = useState(false);
  const [stallbuchAnimal, setStallbuchAnimal] = useState(null);
  const [stallbuchReturnTo, setStallbuchReturnTo] = useState(null);
  const [abgangAnimal, setAbgangAnimal] = useState(null);
  const [abgangReturnTo, setAbgangReturnTo] = useState(null);
  const [stammbaumOpen, setStammbaumOpen] = useState(false);
  const [staelleOpen, setStaelleOpen] = useState(false);
  const [brunstlisteOpen, setBrunstlisteOpen] = useState(false);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileScrollMode, setMobileScrollModeRaw] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get("cattle:mobileScrollMode", false);
        if (!cancelled && res?.value) setMobileScrollModeRaw(res.value === "true");
      } catch (e) {
        // noch keine Einstellung gespeichert
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMobileScrollMode = (updater) => {
    setMobileScrollModeRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      window.storage.set("cattle:mobileScrollMode", String(next), false).catch(() => {});
      return next;
    });
  };

  const [appMode, setAppModeRaw] = useState("admin");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get("cattle:appMode", false);
        if (!cancelled && res?.value === "besucher") setAppModeRaw("besucher");
      } catch (e) {
        // noch kein Modus gespeichert
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAppMode = (next) => {
    setAppModeRaw(next);
    window.storage.set("cattle:appMode", next, false).catch(() => {});
  };
  const [pwPromptOpen, setPwPromptOpen] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const ADMIN_PASSWORD = "1937";
  const checkAdminPassword = () => {
    if (pwInput === ADMIN_PASSWORD) {
      setAppMode("admin");
      setPwPromptOpen(false);
      setPwInput("");
      setPwError("");
    } else {
      setPwError("Falsches Passwort.");
    }
  };

  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [moveFlowOpen, setMoveFlowOpen] = useState(false);
  const [moveFlowAnimal, setMoveFlowAnimal] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importCopyOk, setImportCopyOk] = useState(false);
  const [query, setQuery] = useState("");
  const [listView, setListView] = useState(null); // null | "Gesamt" | Kategoriename
  const [stallAnsicht, setStallAnsicht] = useState(false);
  useEffect(() => {
    setStallAnsicht(false);
  }, [listView]);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (!cancelled && res?.value) {
          const parsed = JSON.parse(res.value);
          animalsRef.current = parsed;
          setAnimals(parsed);
        }
      } catch (e) {
        // no data yet, ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (next) => {
    animalsRef.current = next;
    setAnimals(next);
    try {
      if (!window.storage) {
        setSaveError("Speicher nicht verfügbar (window.storage fehlt).");
        return;
      }
      const res = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      if (!res) setSaveError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
      else setSaveError("");
    } catch (e) {
      setSaveError(`Speichern fehlgeschlagen: ${e?.message || e}`);
    }
  };

  const handleSave = (data) => {
    if (data.id) {
      const updated = { ...animalsRef.current.find((a) => a.id === data.id), ...data };
      persist(animalsRef.current.map((a) => (a.id === data.id ? updated : a)));
      setPassAnimal(updated);
    } else {
      persist([...animalsRef.current, { ...data, id: generateId() }]);
    }
    setFormOpen(false);
    setEditing(null);
    setPresetCategory(null);
    setPresetMotherEarTag(null);
    setFormRegistering(false);
  };

  const handleDelete = (id) => {
    persist(animalsRef.current.filter((a) => a.id !== id));
    setPassAnimal(null);
  };

  const handleUpdateField = (id, patch) => {
    const updated = { ...animalsRef.current.find((a) => a.id === id), ...patch };
    persist(animalsRef.current.map((a) => (a.id === id ? updated : a)));
    setPassAnimal((prev) => (prev && prev.id === id ? updated : prev));
  };

  const handleMove = (id, newCategory, extraPatch = {}) => {
    const existing = animalsRef.current.find((a) => a.id === id);
    if (!existing) return;
    const fg = fixedGenderFor(newCategory);
    const historyEntry = { type: "umgestallt", date: isoDateKey(new Date()), von: existing.category, nach: newCategory };
    const history = Array.isArray(existing.history) ? existing.history : [];
    const updated = {
      ...existing,
      category: newCategory,
      gender: fg || existing.gender,
      originalCategory: newCategory === "Abgänge" ? existing.category : "",
      ...extraPatch,
      history: [...history, historyEntry],
    };
    persist(animalsRef.current.map((a) => (a.id === id ? updated : a)));
    setPassAnimal((prev) => (prev && prev.id === id ? updated : prev));
  };

  const handleCreateUnregistered = (earTag, gender = "weiblich") => {
    if (!earTag || animalsRef.current.some((a) => sameEarTag(a.earTag, earTag))) return;
    const newAnimal = {
      id: generateId(),
      earTag,
      name: "",
      breed: "",
      breedCode: "",
      birthDate: "",
      category: "Unregistriert",
      gender,
      motherEarTag: "",
      fatherEarTag: "",
      merkmale: "",
      auffaelligkeiten: "",
    };
    persist([...animalsRef.current, newAnimal]);
  };

  const handleImport = () => {
    let parsed;
    try {
      parsed = JSON.parse(importText);
    } catch (e) {
      // Fallback: manchmal wird der Text versehentlich doppelt/unsauber
      // eingefügt. Dann probieren wir jede "["-Position (vom Textende her),
      // klammern das jeweils zugehörige Array aus und versuchen es zu parsen.
      const starts = [];
      for (let i = 0; i < importText.length; i++) {
        if (importText[i] === "[") starts.push(i);
      }
      for (let s = starts.length - 1; s >= 0; s--) {
        const start = starts[s];
        let depth = 0;
        let end = -1;
        for (let i = start; i < importText.length; i++) {
          if (importText[i] === "[") depth++;
          else if (importText[i] === "]") {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end === -1) continue;
        try {
          const candidate = JSON.parse(importText.slice(start, end + 1));
          if (Array.isArray(candidate)) {
            parsed = candidate;
            break;
          }
        } catch (e2) {
          // diese Klammerung war kein gültiges JSON, nächste Position probieren
        }
      }
      if (!parsed) {
        setImportError("Das ist kein gültiges JSON. Bitte den exportierten Text unverändert einfügen.");
        return;
      }
    }
    if (!Array.isArray(parsed)) {
      setImportError("Die Daten müssen eine Liste von Tieren sein.");
      return;
    }
    const withIds = parsed.map((a) => ({ ...a, id: a.id || generateId() }));
    persist(withIds);
    setImportError("");
    setImportOpen(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return animals;
    return animals.filter(
      (a) =>
        a.earTag?.toLowerCase().includes(q) ||
        a.name?.toLowerCase().includes(q) ||
        a.breed?.toLowerCase().includes(q)
    );
  }, [animals, query]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (!a.birthDate && !b.birthDate) return 0;
        if (!a.birthDate) return 1;
        if (!b.birthDate) return -1;
        return new Date(b.birthDate) - new Date(a.birthDate);
      }),
    [filtered]
  );

  const byCategory = useMemo(() => {
    const map = {};
    CATEGORIES.forEach((c) => (map[c] = []));
    sorted.forEach((a) => {
      if (CATEGORIES.includes(a.category)) map[a.category].push(a);
    });
    return map;
  }, [sorted]);

  const birthsByDate = useMemo(() => {
    const map = {};
    animals.forEach((a) => {
      if (!a.birthDate) return;
      if (!map[a.birthDate]) map[a.birthDate] = [];
      map[a.birthDate].push(a);
    });
    return map;
  }, [animals]);

  // ===== Adress-Navigation: Zustand <-> URL =====
  // Aus dem aktuellen Zustand die passende Adresse ableiten (oberste sichtbare Seite gewinnt)
  const routeHash = (() => {
    const rid = (a) => encodeURIComponent(a.id);
    if (abgangAnimal) return `#/tier/${rid(abgangAnimal)}/abgang`;
    if (formOpen) {
      if (editing) return `#/tier/${rid(editing)}/${formRegistering ? "registrieren" : "bearbeiten"}`;
      const slug = ROUTE_LIST_SLUGS[presetCategory] || "tier";
      return `#/neu/${slug}` + (presetMotherEarTag ? `?mutter=${encodeURIComponent(presetMotherEarTag)}` : "");
    }
    if (passAnimal) return `#/tier/${rid(passAnimal)}`;
    if (brunstlisteOpen) return "#/brunstliste";
    if (staelleOpen) return "#/staelle";
    if (stammbaumOpen) return "#/stammbaum";
    if (stallbuchAnimal) return `#/tier/${rid(stallbuchAnimal)}/stallbuch`;
    if (historieAnimal) return `#/tier/${rid(historieAnimal)}/historie/${encodeURIComponent(historieTab)}`;
    if (listView) return `#/liste/${ROUTE_LIST_SLUGS[listView] || "gesamt"}`;
    return "#/";
  })();

  const [routeReady, setRouteReady] = useState(false);
  const [routeTick, setRouteTick] = useState(0);
  const routeStackRef = useRef({ list: [], idx: 0 }); // eigene Kopie der Browser-Historie
  const normalizeRouteRef = useRef(false);
  const routeHashRef = useRef(routeHash);
  routeHashRef.current = routeHash;
  const appModeRef = useRef(appMode);
  appModeRef.current = appMode;

  // Eine Adresse in den App-Zustand übersetzen (beim Start, Zurück-Taste, Lesezeichen)
  const applyRoute = (hash) => {
    const { parts, params } = parseRoute(hash);
    const findAnimal = (id) => animalsRef.current.find((a) => a.id === id) || null;
    setPassAnimal(null);
    setHistorieAnimal(null);
    setHistorieReturnTo(null);
    setHistorieReturnToBrunstliste(false);
    setStallbuchAnimal(null);
    setStallbuchReturnTo(null);
    setAbgangAnimal(null);
    setAbgangReturnTo(null);
    setStammbaumOpen(false);
    setStaelleOpen(false);
    setBrunstlisteOpen(false);
    setFormOpen(false);
    setEditing(null);
    setPresetCategory(null);
    setPresetMotherEarTag(null);
    setFormRegistering(false);
    setMainMenuOpen(false);
    setSettingsOpen(false);
    setPwPromptOpen(false);
    setAddPickerOpen(false);
    setMoveFlowOpen(false);
    setMoveFlowAnimal(null);
    setExportOpen(false);
    setImportOpen(false);

    const isAdmin = appModeRef.current === "admin";
    const [p0, p1, p2, p3] = parts;
    if (p0 === undefined) return setListView(null);
    if (p0 === "liste") return setListView(ROUTE_SLUG_TO_LIST[p1] || null);
    if (p0 === "stammbaum") return setStammbaumOpen(true);
    if (p0 === "staelle") return setStaelleOpen(true);
    if (p0 === "brunstliste") return setBrunstlisteOpen(true);
    if (p0 === "neu") {
      if (!isAdmin) return;
      const cat = ROUTE_SLUG_TO_LIST[p1];
      setPresetCategory(CATEGORIES.includes(cat) ? cat : null);
      setPresetMotherEarTag(params.get("mutter") || null);
      setFormOpen(true);
      return;
    }
    if (p0 === "tier") {
      const a = findAnimal(p1);
      if (!a) return;
      if (!p2) return setPassAnimal(a);
      if (p2 === "historie") {
        setHistorieAnimal(a);
        setHistorieTab(p3 || "nachkommen");
        setHistorieReturnTo(a);
        return;
      }
      if (p2 === "stallbuch") {
        setStallbuchAnimal(a);
        setStallbuchReturnTo(a);
        return;
      }
      if (!isAdmin) return setPassAnimal(a); // Besucher dürfen keine Formulare öffnen
      if (p2 === "bearbeiten" || p2 === "registrieren") {
        setEditing(a);
        setFormRegistering(p2 === "registrieren");
        setFormOpen(true);
        return;
      }
      if (p2 === "abgang") {
        setAbgangAnimal(a);
        setAbgangReturnTo(a);
        return;
      }
      setPassAnimal(a);
    }
  };

  // Start: sobald die Tiere geladen sind, die Seite aus der Adresse öffnen
  useEffect(() => {
    if (loading || routeReady) return;
    const hash = currentRouteHash();
    const hs = window.history.state;
    const idx = hs && typeof hs.rbIdx === "number" ? hs.rbIdx : 0;
    routeStackRef.current = { list: [], idx };
    routeStackRef.current.list[idx] = hash;
    try {
      window.history.replaceState({ rbIdx: idx }, "", hash);
    } catch (e) {}
    normalizeRouteRef.current = true;
    applyRoute(hash);
    setRouteReady(true);
  }, [loading]);

  // Zustand geändert -> Adresse nachziehen (neuer Eintrag, ersetzen oder zurückgehen)
  useEffect(() => {
    if (!routeReady) return;
    const normalize = normalizeRouteRef.current;
    normalizeRouteRef.current = false;
    const st = routeStackRef.current;
    const target = routeHash;
    const cur = currentRouteHash();
    if (target === cur) {
      st.list[st.idx] = target;
      return;
    }
    try {
      if (normalize || sameRoutePage(cur, target)) {
        st.list[st.idx] = target;
        window.history.replaceState({ rbIdx: st.idx }, "", target);
      } else if (st.idx > 0 && st.list[st.idx - 1] === target) {
        // Ziel ist die vorherige Seite: echt zurückgehen, damit keine doppelten Einträge entstehen
        window.history.back();
      } else if (isFormRoute(cur)) {
        st.list[st.idx] = target;
        window.history.replaceState({ rbIdx: st.idx }, "", target);
      } else {
        st.idx += 1;
        st.list.length = st.idx;
        st.list[st.idx] = target;
        window.history.pushState({ rbIdx: st.idx }, "", target);
      }
    } catch (e) {
      // Manche Umgebungen erlauben keine Adressänderung – App funktioniert trotzdem
    }
  }, [routeHash, routeReady, routeTick]);

  // Zurück-/Vor-Taste des Browsers oder Handys und von Hand geänderte Adresse
  useEffect(() => {
    if (!routeReady) return;
    const onPop = (e) => {
      const st = routeStackRef.current;
      const hash = currentRouteHash();
      if (e.state && typeof e.state.rbIdx === "number") {
        st.idx = e.state.rbIdx;
      } else {
        st.idx += 1;
        st.list.length = st.idx;
        try {
          window.history.replaceState({ rbIdx: st.idx }, "", hash);
        } catch (err) {}
      }
      st.list[st.idx] = hash;
      if (hash !== routeHashRef.current) {
        normalizeRouteRef.current = true;
        applyRoute(hash);
        setRouteTick((t) => t + 1);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [routeReady]);

  return (
    <AppModeContext.Provider value={appMode}>
    <MobileScrollContext.Provider value={mobileScrollMode}>
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#F9EFE4" }}>

      <header
        className="border-b border-[#D9CFB8] px-5 pt-6 pb-4"
        style={{ backgroundColor: "#F9EFE4" }}
      >
        <div className="flex items-center gap-2 text-[#6B6858] text-xs uppercase tracking-[0.2em] mb-1">
          <TagIcon size={14} />
          <span>Bestandsbuch</span>
        </div>
        <h1 className="font-slab text-2xl font-bold text-[#2B2A26]">Rinderbestand</h1>

        <div className="grid grid-cols-5 gap-2 mt-4">
          <button
            type="button"
            onClick={() => setListView((v) => (v === "Gesamt" ? null : "Gesamt"))}
            className="h-[68px] bg-white text-[#2B2A26] border border-[#D9CFB8] rounded-lg px-2 py-2 flex flex-col items-center justify-center text-center transition"
            style={listView === "Gesamt" ? { boxShadow: "0 0 0 2px #2B2A26 inset" } : undefined}
          >
            <p className="text-[10px] uppercase tracking-wide text-[#6B6858] whitespace-nowrap">Gesamt</p>
            <p className="font-slab font-bold" style={{ fontSize: "20px", lineHeight: "1.2", fontVariantNumeric: "tabular-nums", fontFamily: "'Arvo', serif" }}>
              {animals.filter((a) => CATEGORIES.includes(a.category)).length}
            </p>
          </button>
          {CATEGORIES.map((cat) => {
            const color = colorForCategory(cat);
            const active = listView === cat;
            return (
              <button
                type="button"
                key={cat}
                onClick={() => setListView((v) => (v === cat ? null : cat))}
                className="h-[68px] rounded-lg px-2 py-2 flex flex-col items-center justify-center text-center overflow-hidden transition"
                style={{
                  backgroundColor: color.bg,
                  color: color.fg,
                  boxShadow: active ? "0 0 0 2px #2B2A26 inset" : undefined,
                }}
              >
                <p className="text-[10px] uppercase tracking-wide opacity-80 truncate w-full">{cat}</p>
                <p className="font-slab font-bold" style={{ fontSize: "20px", lineHeight: "1.2", fontVariantNumeric: "tabular-nums", fontFamily: "'Arvo', serif" }}>
                  {byCategory[cat]?.length || 0}
                </p>
              </button>
            );
          })}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suche nach Ohrmarke, Name oder Rasse…"
          className="w-full mt-4 px-3 py-2 rounded-lg border border-[#D9CFB8] bg-white text-[#2B2A26] text-sm focus:outline-none focus:ring-2 focus:ring-[#4C6B3F]"
        />
      </header>

      <main className="px-5 py-4 pb-28">
        {listView === null && query.trim() === "" && (
          <>
            <NotesBox />
            <BirthCalendar
              birthsByDate={birthsByDate}
              onOpenAnimal={(a) => setPassAnimal(a)}
              animals={animals}
              onUpdateAnimal={handleUpdateField}
              onOpenBreedingHistory={(a) => {
                setHistorieAnimal(a);
                setHistorieTab("brunsthistorie");
              }}
            />
            <BrunstVorschauCard
              animals={animals.filter((a) => a.category === "Mutterkühe" || a.category === "Jungrinder")}
              onOpenAnimal={(a) => setPassAnimal(a)}
              onUpdateAnimal={handleUpdateField}
              addHistoryEvent={(animal, type, date) => {
                const history = Array.isArray(animal.history) ? animal.history : [];
                handleUpdateField(animal.id, { history: [...history, { type, date }] });
              }}
              onOpenHistory={(a) => {
                setHistorieAnimal(a);
                setHistorieTab("brunsthistorie");
              }}
              onShowAll={() => setBrunstlisteOpen(true)}
              onOpenAddCalf={(a) => {
                setPresetCategory("Kälber");
                setPresetMotherEarTag(a.earTag);
                setEditing(null);
                setFormOpen(true);
              }}
            />
            <div className="flex flex-col gap-2 mb-6">
              <button
                type="button"
                onClick={() => setStammbaumOpen(true)}
                className="w-full rounded-xl border px-4 py-3 flex items-center justify-between transition"
                style={{
                  backgroundColor: colorForCategory("Stammbaum").bg,
                  borderColor: colorForCategory("Stammbaum").bg,
                }}
              >
                <span className="font-slab text-sm font-bold" style={{ color: colorForCategory("Stammbaum").fg }}>
                  Stammbaum
                </span>
                <ChevronRight size={18} style={{ color: colorForCategory("Stammbaum").fg }} />
              </button>
              <button
                type="button"
                onClick={() => setStaelleOpen(true)}
                className="w-full rounded-xl border px-4 py-3 flex items-center justify-between transition"
                style={{
                  backgroundColor: colorForCategory("Ställe").bg,
                  borderColor: "#D9CFB8",
                }}
              >
                <span className="font-slab text-sm font-bold" style={{ color: colorForCategory("Ställe").fg }}>
                  Ställe
                </span>
                <ChevronRight size={18} style={{ color: colorForCategory("Ställe").fg }} />
              </button>
              <button
                type="button"
                onClick={() => setListView("Abgänge")}
                className="w-full rounded-xl border px-4 py-3 flex items-center justify-between transition"
                style={{ backgroundColor: colorForCategory("Abgänge").bg, borderColor: colorForCategory("Abgänge").bg }}
              >
                <span className="flex flex-col items-start">
                  <span className="font-slab text-sm font-bold" style={{ color: colorForCategory("Abgänge").fg }}>
                    Abgänge
                  </span>
                  <span className="text-xs opacity-80" style={{ color: colorForCategory("Abgänge").fg }}>
                    {animals.filter((a) => a.category === "Abgänge").length} Stück
                  </span>
                </span>
                <ChevronRight size={18} style={{ color: colorForCategory("Abgänge").fg }} />
              </button>
              <button
                type="button"
                onClick={() => setListView("Unregistriert")}
                className="w-full rounded-xl border px-4 py-3 flex items-center justify-between transition"
                style={{
                  backgroundColor: colorForCategory("Unregistriert").bg,
                  borderColor: colorForCategory("Unregistriert").bg,
                }}
              >
                <span className="flex flex-col items-start">
                  <span className="font-slab text-sm font-bold" style={{ color: colorForCategory("Unregistriert").fg }}>
                    Unregistrierte Ohrenmarken
                  </span>
                  <span className="text-xs opacity-80" style={{ color: colorForCategory("Unregistriert").fg }}>
                    {animals.filter((a) => a.category === "Unregistriert").length} Stück
                  </span>
                </span>
                <ChevronRight size={18} style={{ color: colorForCategory("Unregistriert").fg }} />
              </button>
              <button
                type="button"
                onClick={() => {}}
                className="w-full rounded-xl border px-4 py-3 flex items-center justify-between transition"
                style={{
                  backgroundColor: colorForCategory("Samenbank").bg,
                  borderColor: colorForCategory("Samenbank").bg,
                }}
              >
                <span className="font-slab text-sm font-bold" style={{ color: colorForCategory("Samenbank").fg }}>
                  Samenbank
                </span>
                <ChevronRight size={18} style={{ color: colorForCategory("Samenbank").fg }} />
              </button>
            </div>
          </>
        )}

        {loading ? (
          <p className="text-center text-[#8A8672] mt-10">Lade Bestand…</p>
        ) : listView === null && query.trim() === "" ? (
          animals.length === 0 ? (
            <div className="text-center mt-16 px-6">
              <TagIcon size={32} className="mx-auto text-[#B9AF95] mb-3" />
              <p className="font-slab text-lg font-bold text-[#2B2A26] mb-1">Noch keine Tiere erfasst</p>
              <p className="text-sm text-[#8A8672]">
                Mit dem Plus-Button unten legst du ein Kalb an. Mutterkühe, Jungrinder und Deckbullen legst du
                direkt im jeweiligen Abschnitt an (Kachel oben antippen).
              </p>
            </div>
          ) : (
            <div className="text-center mt-10 px-6">
              <p className="text-sm text-[#8A8672]">
                Tippe oben auf „Gesamt" oder einen Abschnitt, um die Tierliste zu sehen.
              </p>
            </div>
          )
        ) : query.trim() !== "" && sorted.length === 0 ? (
          <div className="text-center mt-16 px-6">
            <TagIcon size={32} className="mx-auto text-[#B9AF95] mb-3" />
            <p className="font-slab text-lg font-bold text-[#2B2A26] mb-1">Keine Treffer</p>
            <p className="text-sm text-[#8A8672]">Versuch eine andere Suche.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2 px-0.5 gap-2 flex-wrap">
              <h2 className="font-slab text-sm font-bold text-[#2B2A26] uppercase tracking-wide">
                {listView === null
                  ? "Suchergebnisse"
                  : listView === "Gesamt"
                  ? "Gesamter Bestand"
                  : listView === "Unregistriert"
                  ? "Unregistrierte Ohrenmarken"
                  : listView}
              </h2>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {(CATEGORIES.includes(listView) || listView === "Gesamt") && (
                  <div className="flex rounded-full border border-[#D9CFB8] bg-white p-0.5 gap-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setStallAnsicht(false)}
                      className="rounded-full px-2.5 py-1 font-semibold"
                      style={!stallAnsicht ? { backgroundColor: "#2B2A26", color: "#F2EBDD" } : { color: "#6B6858" }}
                    >
                      Liste
                    </button>
                    <button
                      type="button"
                      onClick={() => setStallAnsicht(true)}
                      className="rounded-full px-2.5 py-1 font-semibold"
                      style={stallAnsicht ? { backgroundColor: "#2B2A26", color: "#F2EBDD" } : { color: "#6B6858" }}
                    >
                      Stall
                    </button>
                  </div>
                )}
                {appMode === "admin" && listView !== null && listView !== "Gesamt" && listView !== "Unregistriert" && listView !== "Abgänge" && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setPresetCategory(listView);
                      setPresetMotherEarTag(null);
                      setFormOpen(true);
                    }}
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: colorForCategory(listView).bg, color: colorForCategory(listView).fg }}
                    aria-label={`Neues Tier bei ${listView} hinzufügen`}
                  >
                    <Plus size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setListView(null);
                    setQuery("");
                  }}
                  className="text-xs font-semibold rounded-lg px-3 py-1.5 transition whitespace-nowrap"
                  style={{ color: "#FFFFFF", backgroundColor: "#2B2A26", border: "1px solid #2B2A26" }}
                >
                  {listView === null ? "Suche leeren" : "Zurück"}
                </button>
              </div>
            </div>
            {listView === null
              ? (
                  <SectionTable
                    title="Suchergebnisse"
                    color={FALLBACK_COLOR}
                    animals={sorted}
                    onOpenAnimal={(a) => setPassAnimal(a)}
                  />
                )
              : stallAnsicht && listView === "Gesamt"
              ? (
                  <AnimalsByStallView
                    animals={sorted.filter((a) => CATEGORIES.includes(a.category))}
                    color={FALLBACK_COLOR}
                    onOpenAnimal={(a) => setPassAnimal(a)}
                  />
                )
              : listView === "Gesamt"
              ? CATEGORIES.map((cat) => (
                  <SectionTable
                    key={cat}
                    title={cat}
                    color={colorForCategory(cat)}
                    animals={byCategory[cat]}
                    onOpenAnimal={(a) => setPassAnimal(a)}
                    showParents={cat === "Kälber" || cat === "Jungrinder"}
                    showGender={cat === "Kälber"}
                  />
                ))
              : stallAnsicht && CATEGORIES.includes(listView)
              ? (
                  <AnimalsByStallView
                    animals={byCategory[listView] || []}
                    color={colorForCategory(listView)}
                    onOpenAnimal={(a) => setPassAnimal(a)}
                    showParents={listView === "Kälber" || listView === "Jungrinder"}
                    showGender={listView === "Kälber"}
                  />
                )
              : listView === "Mutterkühe"
              ? COW_TIERS.map((tier) => (
                  <SectionTable
                    key={tier}
                    title={tier}
                    color={colorForCategory("Mutterkühe")}
                    animals={groupCowsByTier(byCategory["Mutterkühe"] || [])[tier]}
                    onOpenAnimal={(a) => setPassAnimal(a)}
                  />
                ))
              : listView === "Unregistriert"
              ? (
                  <SectionTable
                    title="Unregistrierte Ohrenmarken"
                    color={colorForCategory("Unregistriert")}
                    animals={sorted.filter((a) => a.category === "Unregistriert")}
                    onOpenAnimal={(a) => setPassAnimal(a)}
                  />
                )
              : listView === "Abgänge"
              ? (
                  <>
                    <SectionTable
                      title="Verendet"
                      color={{ bg: "#BB201D", fg: "#FFFFFF" }}
                      animals={sortByAbgangsDatum(sorted.filter((a) => a.category === "Abgänge" && a.abgangsGrund === "verendet"))}
                      showAbgangsDatum
                      collapsible
                      onOpenAnimal={(a) => setPassAnimal(a)}
                    />
                    <SectionTable
                      title="Verkauft"
                      color={{ bg: "#FBCD49", fg: "#2B2A26" }}
                      animals={sortByAbgangsDatum(sorted.filter((a) => a.category === "Abgänge" && a.abgangsGrund === "verkauft"))}
                      showAbgangsDatum
                      collapsible
                      onOpenAnimal={(a) => setPassAnimal(a)}
                    />
                  </>
                )
              : (
                  <>
                    {listView === "Kälber" && (
                      <PendingTagCallout calves={byCategory["Kälber"]} onOpenAnimal={(a) => setPassAnimal(a)} />
                    )}
                    <SectionTable
                      title={listView}
                      color={colorForCategory(listView)}
                      animals={byCategory[listView] || []}
                      onOpenAnimal={(a) => setPassAnimal(a)}
                      showParents={listView === "Kälber" || listView === "Jungrinder"}
                      showGender={listView === "Kälber"}
                    />
                  </>
                )}
          </div>
        )}
        {saveError && <p className="text-center text-[#8B3A3A] text-sm mt-4">{saveError}</p>}
      </main>

      {listView === null && (
        <button
          onClick={() => setMainMenuOpen(true)}
          className="fixed bottom-6 right-5 z-10 w-14 h-14 rounded-full bg-white text-[#2B2A26] border border-[#D9CFB8] shadow-lg flex items-center justify-center hover:bg-[#F9EFE4] transition"
          aria-label="Menü öffnen"
        >
          <MoreVertical size={26} />
        </button>
      )}

      {mainMenuOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setMainMenuOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl border border-[#D9CFB8] p-5 pb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-slab text-lg font-bold text-[#2B2A26]">Menü</h2>
              <button
                type="button"
                onClick={() => setMainMenuOpen(false)}
                className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMainMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg border border-[#D9CFB8] font-semibold text-[#2B2A26] hover:bg-[#F9EFE4] transition"
              >
                <Settings size={18} />
                Einstellungen
              </button>
              {appMode === "admin" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMainMenuOpen(false);
                      setAddPickerOpen(true);
                    }}
                    className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg border border-[#D9CFB8] font-semibold text-[#2B2A26] hover:bg-[#F9EFE4] transition"
                  >
                    <Plus size={18} />
                    Tier hinzufügen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMainMenuOpen(false);
                      setMoveFlowAnimal(null);
                      setMoveFlowOpen(true);
                    }}
                    className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg border border-[#D9CFB8] font-semibold text-[#2B2A26] hover:bg-[#F9EFE4] transition"
                  >
                    <ArrowUpDown size={18} />
                    Tier verschieben
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl border border-[#D9CFB8] p-5 pb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-slab text-lg font-bold text-[#2B2A26]">Einstellungen</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (appMode === "admin") {
                    setAppMode("besucher");
                  } else {
                    setPwInput("");
                    setPwError("");
                    setPwPromptOpen(true);
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#D9CFB8] hover:bg-[#F9EFE4] transition"
              >
                <span className="text-left">
                  <span className="block font-semibold text-[#2B2A26]">
                    Modus: {appMode === "admin" ? "Admin" : "Besucher"}
                  </span>
                  <span className="block text-xs text-[#8A8672]">
                    {appMode === "admin"
                      ? "Wechsle zu Besucher, um nur Ansehen zu erlauben (keine Änderungen)."
                      : "Nur Ansehen aktiv. Zum Bearbeiten zurück zu Admin wechseln."}
                  </span>
                </span>
                <span
                  className="shrink-0 w-10 h-6 rounded-full relative transition"
                  style={{ backgroundColor: appMode === "besucher" ? "#4C6B3F" : "#D9CFB8" }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition"
                    style={{ left: appMode === "besucher" ? 18 : 2 }}
                  />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMobileScrollMode((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#D9CFB8] hover:bg-[#F9EFE4] transition"
              >
                <span className="text-left">
                  <span className="block font-semibold text-[#2B2A26]">Handy-Ansicht</span>
                  <span className="block text-xs text-[#8A8672]">Kalender & Tabellen horizontal scrollbar statt gequetscht</span>
                </span>
                <span
                  className="shrink-0 w-10 h-6 rounded-full relative transition"
                  style={{ backgroundColor: mobileScrollMode ? "#4C6B3F" : "#D9CFB8" }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition"
                    style={{ left: mobileScrollMode ? 18 : 2 }}
                  />
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setExportOpen(true);
                }}
                className="w-full text-left px-4 py-3 rounded-lg border border-[#D9CFB8] font-semibold text-[#2B2A26] hover:bg-[#F9EFE4] transition"
              >
                Daten exportieren
              </button>
              {appMode === "admin" && (
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setImportText("");
                    setImportError("");
                    setImportOpen(true);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg border border-[#D9CFB8] font-semibold text-[#2B2A26] hover:bg-[#F9EFE4] transition"
                >
                  Daten importieren
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {pwPromptOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end sm:items-center justify-center"
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setPwPromptOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl border border-[#D9CFB8] p-5 pb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-slab text-lg font-bold text-[#2B2A26]">Admin-Passwort</h2>
              <button
                type="button"
                onClick={() => setPwPromptOpen(false)}
                className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-[#8A8672] mb-3">Gib das Passwort ein, um in den Admin-Modus zu wechseln.</p>
            <input
              type="password"
              value={pwInput}
              autoFocus
              onChange={(e) => setPwInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkAdminPassword()}
              placeholder="Passwort"
              className="w-full mb-3 px-3 py-2 rounded-lg border bg-white text-[#2B2A26] text-sm focus:outline-none"
              style={{ borderColor: pwError ? "#BB201D" : "#9CA3AF" }}
            />
            {pwError && <p className="text-[#BB201D] text-sm mb-3">{pwError}</p>}
            <button
              type="button"
              onClick={checkAdminPassword}
              className="w-full py-2.5 rounded-lg font-semibold"
              style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
            >
              Bestätigen
            </button>
          </div>
        </div>
      )}

      {moveFlowOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setMoveFlowOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl border border-[#D9CFB8] p-5 pb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-slab text-lg font-bold text-[#2B2A26]">Tier verschieben</h2>
              <button
                type="button"
                onClick={() => setMoveFlowOpen(false)}
                className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
              >
                <X size={20} />
              </button>
            </div>

            {!moveFlowAnimal ? (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B6858] mb-1">
                  Tier suchen
                </label>
                <EarTagSearchSelect
                  value=""
                  onChange={(earTag) => {
                    const found = animals.find((a) => sameEarTag(a.earTag, earTag));
                    if (found) setMoveFlowAnimal(found);
                  }}
                  options={animals}
                  placeholder="Ohrmarke oder Namen suchen…"
                  emptyLabel="Bitte wählen…"
                />
              </>
            ) : (
              <>
                <p className="text-sm text-[#8A8672] mb-1">Ausgewähltes Tier</p>
                <div
                  className="rounded-lg px-3 py-2 mb-4 text-sm font-semibold"
                  style={{
                    backgroundColor: colorForCategory(moveFlowAnimal.category).bg,
                    color: colorForCategory(moveFlowAnimal.category).fg,
                  }}
                >
                  {formatEarTag(moveFlowAnimal.earTag) || "ausstehend"}
                  {moveFlowAnimal.name ? ` – ${moveFlowAnimal.name}` : ""} ({moveFlowAnimal.category})
                </div>

                <p className="text-sm text-[#2B2A26] mb-2">Wohin soll das Tier verschoben werden?</p>
                {moveOptions(moveFlowAnimal).length === 0 ? (
                  <p className="text-sm text-[#8A8672] mb-3">
                    Für diesen Abschnitt ist aktuell kein Verschieben möglich.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 mb-3">
                    {moveOptions(moveFlowAnimal).map((dest) => {
                      const color = colorForCategory(dest);
                      return (
                        <button
                          type="button"
                          key={dest}
                          onClick={() => {
                            if (dest === "Abgänge") {
                              setAbgangAnimal(moveFlowAnimal);
                            } else {
                              handleMove(moveFlowAnimal.id, dest);
                            }
                            setMoveFlowOpen(false);
                            setMoveFlowAnimal(null);
                          }}
                          className="w-full py-2.5 rounded-lg font-semibold text-left px-3"
                          style={{ backgroundColor: color.bg, color: color.fg }}
                        >
                          {dest}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setMoveFlowAnimal(null)}
                  className="w-full py-2 rounded-lg font-medium"
                  style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
                >
                  Anderes Tier wählen
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {addPickerOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setAddPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl border border-[#D9CFB8] p-5 pb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-slab text-lg font-bold text-[#2B2A26]">Welcher Abschnitt?</h2>
              <button
                type="button"
                onClick={() => setAddPickerOpen(false)}
                className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-[#8A8672] mb-4">Wähle, welche Art Tier du anlegen möchtest.</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const color = colorForCategory(cat);
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => {
                      setAddPickerOpen(false);
                      setEditing(null);
                      setPresetCategory(cat);
                      setPresetMotherEarTag(null);
                      setFormOpen(true);
                    }}
                    className="rounded-lg px-3 py-4 text-sm font-semibold transition active:scale-[0.98]"
                    style={{ backgroundColor: color.bg, color: color.fg }}
                  >
                    {CATEGORY_SINGULAR[cat]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {passAnimal && !formOpen && (
        <AnimalPass
          animal={passAnimal}
          allAnimals={animals}
          onEdit={(a, registering) => {
            setEditing(a);
            setFormRegistering(!!registering);
            setPassAnimal(null);
            setFormOpen(true);
          }}
          onClose={() => setPassAnimal(null)}
          onOpenAnimal={(a) => setPassAnimal(a)}
          onShowAllDescendants={(a) => {
            setHistorieAnimal(a);
            setHistorieTab("nachkommen");
            setHistorieReturnTo(a);
            setPassAnimal(null);
          }}
          onUpdateField={handleUpdateField}
          onMove={handleMove}
          onOpenBreedingHistory={(a) => {
            setHistorieAnimal(a);
            setHistorieTab("brunsthistorie");
            setHistorieReturnTo(a);
            setPassAnimal(null);
          }}
          onOpenStallbuch={(a) => {
            setStallbuchAnimal(a);
            setStallbuchReturnTo(a);
            setPassAnimal(null);
          }}
          onRequestAbgang={(a) => {
            setAbgangAnimal(a);
            setAbgangReturnTo(a);
            setPassAnimal(null);
          }}
        />
      )}

      {abgangAnimal && (
        <AbgangsFormular
          animal={abgangAnimal}
          onCancel={() => {
            if (abgangReturnTo) setPassAnimal(abgangReturnTo);
            setAbgangReturnTo(null);
            setAbgangAnimal(null);
          }}
          onSave={(data) => {
            handleMove(abgangAnimal.id, "Abgänge", data);
            setAbgangReturnTo(null);
            setAbgangAnimal(null);
          }}
        />
      )}

      {historieAnimal && (
        <HistorieView
          animal={historieAnimal}
          allAnimals={animals}
          initialTab={historieTab}
          onTabChange={(t) => setHistorieTab(t)}
          onOpenAnimal={(a) => setPassAnimal(a)}
          onBack={() => {
            if (historieReturnToBrunstliste) setBrunstlisteOpen(true);
            else if (historieReturnTo) setPassAnimal(historieReturnTo);
            setHistorieReturnToBrunstliste(false);
            setHistorieReturnTo(null);
            setHistorieAnimal(null);
          }}
        />
      )}

      {stallbuchAnimal && (
        <StallbuchView
          animal={stallbuchAnimal}
          onBack={() => {
            if (stallbuchReturnTo) setPassAnimal(stallbuchReturnTo);
            setStallbuchReturnTo(null);
            setStallbuchAnimal(null);
          }}
        />
      )}

      {stammbaumOpen && (
        <StammbaumView
          animals={animals}
          onBack={() => setStammbaumOpen(false)}
          onOpenAnimal={(a) => setPassAnimal(a)}
        />
      )}

      {staelleOpen && <StaelleView onBack={() => setStaelleOpen(false)} />}

      {brunstlisteOpen && (
        <BrunstlisteView
          animals={animals.filter((a) => a.category === "Mutterkühe" || a.category === "Jungrinder")}
          onOpenAnimal={(a) => setPassAnimal(a)}
          onUpdateAnimal={handleUpdateField}
          addHistoryEvent={(animal, type, date) => {
            const history = Array.isArray(animal.history) ? animal.history : [];
            handleUpdateField(animal.id, { history: [...history, { type, date }] });
          }}
          onOpenHistory={(a) => {
            setHistorieAnimal(a);
            setHistorieTab("brunsthistorie");
            setHistorieReturnToBrunstliste(true);
            setBrunstlisteOpen(false);
          }}
          onBack={() => setBrunstlisteOpen(false)}
          onOpenAddCalf={(a) => {
            setPresetCategory("Kälber");
            setPresetMotherEarTag(a.earTag);
            setEditing(null);
            setFormOpen(true);
            setBrunstlisteOpen(false);
          }}
        />
      )}

      {formOpen && (
        <AnimalForm
          initial={editing}
          initialCategory={presetCategory}
          initialMotherEarTag={presetMotherEarTag}
          registering={formRegistering}
          allAnimals={animals}
          onSave={handleSave}
          onCreateUnregistered={handleCreateUnregistered}
          onDelete={(id) => {
            handleDelete(id);
            setFormOpen(false);
            setEditing(null);
            setPresetCategory(null);
            setFormRegistering(false);
          }}
          onCancel={() => {
            setFormOpen(false);
            if (editing) setPassAnimal(editing);
            setEditing(null);
            setPresetCategory(null);
            setFormRegistering(false);
          }}
        />
      )}

      {exportOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setExportOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-[#D9CFB8] p-5 pb-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-slab text-lg font-bold text-[#2B2A26]">Daten exportieren</h2>
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-[#8A8672] mb-3">
              Kopiere den kompletten Text unten und füge ihn in der anderen Version bei „Daten importieren" ein.
            </p>
            <textarea
              readOnly
              value={JSON.stringify(animals, null, 2)}
              rows={12}
              className="w-full mb-3 px-3 py-2 rounded-lg border bg-white text-[#2B2A26] text-xs font-mono focus:outline-none"
              style={{ borderColor: "#9CA3AF" }}
              onFocus={(e) => e.target.select()}
            />
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(animals, null, 2));
                    setImportCopyOk(true);
                    setTimeout(() => setImportCopyOk(false), 2000);
                  } catch (e) {
                    // Clipboard-Zugriff kann fehlschlagen (z. B. fehlende Berechtigung);
                    // der Text im Feld oben lässt sich dann weiterhin manuell markieren und kopieren.
                  }
                }}
                className="flex-1 py-2.5 rounded-lg font-semibold"
                style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
              >
                {importCopyOk ? "Kopiert!" : "In Zwischenablage kopieren"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(animals, null, 2)], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const today = isoDateKey(new Date());
                a.download = `rinderbestand-export-${today}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="w-full py-2.5 rounded-lg font-semibold border"
              style={{ borderColor: "#2B2A26", color: "#2B2A26" }}
            >
              Als Textdatei herunterladen
            </button>
          </div>
        </div>
      )}

      {importOpen && appMode === "admin" && (
        <div
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setImportOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-[#D9CFB8] p-5 pb-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-slab text-lg font-bold text-[#2B2A26]">Daten importieren</h2>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="p-1 text-[#8A8672] hover:text-[#2B2A26]"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-[#8A8672] mb-3">
              Füge hier den Text aus „Daten exportieren" ein oder wähle die heruntergeladene Datei aus. Achtung: Das ersetzt den kompletten aktuellen
              Bestand in dieser Version.
            </p>
            <input
              type="file"
              accept=".txt,.json,text/plain,application/json"
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setImportText(String(reader.result || ""));
                  setImportError("");
                };
                reader.onerror = () => {
                  setImportError("Datei konnte nicht gelesen werden.");
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
              className="w-full mb-3 text-sm text-[#2B2A26]"
            />
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              placeholder="Hier einfügen…"
              className="w-full mb-3 px-3 py-2 rounded-lg border bg-white text-[#2B2A26] text-xs font-mono focus:outline-none"
              style={{ borderColor: "#9CA3AF" }}
            />
            {importError && <p className="text-[#8B3A3A] text-sm mb-3">{importError}</p>}
            <button
              type="button"
              onClick={handleImport}
              disabled={!importText.trim()}
              className="w-full py-2.5 rounded-lg font-semibold disabled:opacity-40"
              style={{ backgroundColor: "#2B2A26", color: "#FFFFFF" }}
            >
              Importieren (ersetzt aktuellen Bestand)
            </button>
          </div>
        </div>
      )}
    </div>
    </MobileScrollContext.Provider>
    </AppModeContext.Provider>
  );
}


  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(RinderbestandApp));
} catch (err) {
  var box = document.getElementById('boot-error');
  box.style.display = 'block';
  box.textContent = 'Fehler beim Start der App:\n' + (err && err.stack ? err.stack : err);
  console.error(err);
}
