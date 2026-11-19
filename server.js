// ResearchPilot backend: Node.js built-ins only (no npm install needed). Run: node server.js
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const MODULES = require("./modules");
const PORT = process.env.PORT || 3000, ROOT = __dirname, PUB = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data"), UP = path.join(ROOT, "uploads"), DBF = path.join(DATA, "db.json"), SECF = path.join(DATA, "secret.txt");
fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(UP, { recursive: true });

// ---------- tiny file database ----------
let db = fs.existsSync(DBF) ? JSON.parse(fs.readFileSync(DBF, "utf8")) : { users: [], seq: 0, activity: [] };
for (const k of Object.keys(MODULES)) db[k] = db[k] || [];
db.activity = db.activity || [];
let timer;
const save = () => { clearTimeout(timer); timer = setTimeout(flush, 50); };
const flush = () => fs.writeFileSync(DBF, JSON.stringify(db));
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { flush(); process.exit(); });
const SECRET = process.env.SECRET || (fs.existsSync(SECF) ? fs.readFileSync(SECF, "utf8") : (() => { const s = crypto.randomBytes(32).toString("hex"); fs.writeFileSync(SECF, s); return s; })());

// ---------- auth (password hashing + signed tokens) ----------
const b64 = (x) => Buffer.from(x).toString("base64url");
const sign = (p) => crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
const makeToken = (u) => { const p = b64(JSON.stringify({ id: u.id, exp: Date.now() + 12 * 3600e3 })); return p + "." + sign(p); };
function readToken(t) {
  const [p, s] = (t || "").split(".");
  if (!p || !s || sign(p) !== s) return null;
  const d = JSON.parse(Buffer.from(p, "base64url")); return d.exp > Date.now() ? d : null;
}
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString("hex");
const tries = {};
const limited = (ip) => { const n = Date.now(), a = (tries[ip] = (tries[ip] || []).filter((t) => n - t < 60000)); a.push(n); return a.length > 10; };

// ---------- helpers ----------
const send = (res, code, obj, type = "application/json", extra = {}) => { res.writeHead(code, { "Content-Type": type, "X-Content-Type-Options": "nosniff", ...extra }); res.end(typeof obj === "string" || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj)); };
const body = (req, limit = 1e6) => new Promise((ok, bad) => { const c = []; let n = 0;
  req.on("data", (d) => { n += d.length; if (n > limit) { bad(new Error("Too large")); req.destroy(); } else c.push(d); }); req.on("end", () => ok(Buffer.concat(c))); });
const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const log = (u, action, model, text) => { db.activity.push({ owner: u.id, action, model, text: String(text).slice(0, 120), at: new Date().toISOString() }); if (db.activity.length > 1000) db.activity.shift(); };

function clean(c, data, user, existing) {
  const out = {}, errs = [];
  for (const f of MODULES[c].fields) {
    let v = data[f.name];
    if (v === undefined) { if (existing) continue; v = null; }
    if (f.type === "number" || f.type === "fk") v = v === "" || v === null ? null : Number(v);
    else if (f.type === "checkbox") v = !!v;
    else v = v == null ? "" : String(v).slice(0, 20000).trim();
    if (f.required && (v === null || v === "")) errs.push(`${f.label} is required`);
    if ((f.type === "number" || f.type === "fk") && v !== null && Number.isNaN(v)) errs.push(`${f.label} must be a number`);
    if (f.type === "select" && v && !f.options.some((o) => o.value === v)) errs.push(`${f.label} is invalid`);
    if (f.type === "fk" && v !== null && !db[f.ref].some((r) => r.id === v && r.owner === user.id)) errs.push(`${f.label}: invalid reference`);
    out[f.name] = v;
  }
  if (c === "papers") {
    const doi = (out.doi ?? existing?.doi ?? "").toLowerCase(), title = norm(out.title ?? existing?.title);
    if (out.doi !== undefined) out.doi = doi;
    for (const p of db.papers) if (p.owner === user.id && p.id !== existing?.id) {
      if (doi && p.doi === doi) errs.push("Duplicate: a paper with this DOI already exists");
      else if (norm(p.title) === title) errs.push("Duplicate: a paper with a very similar title exists");
    }
  }
  return { out, errs };
}
function removeRow(c, id) {
  db[c] = db[c].filter((r) => r.id !== id);
  for (const [k, m] of Object.entries(MODULES)) for (const f of m.fields) if (f.type === "fk" && f.ref === c)
    for (const r of [...db[k]]) if (r.id !== undefined && r[f.name] === id) { if (f.required) removeRow(k, r.id); else r[f.name] = null; }
}

// ---------- reports ----------
function dashboard(u) {
  const mine = (c) => db[c].filter((r) => r.owner === u.id), P = mine("papers"), T = mine("tasks"), S = mine("submissions"), V = mine("venues");
  const count = (a, f) => a.reduce((m, r) => ((m[r[f]] = (m[r[f]] || 0) + 1), m), {});
  const sec = mine("sections"), today = new Date().toISOString().slice(0, 10);
  const weekly = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5), k = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString("en", { weekday: "short" }), n: db.activity.filter((a) => a.owner === u.id && a.at.startsWith(k)).length }; });
  const vt = (id) => V.find((v) => v.id === id)?.pub_type, started = S.filter((s) => !["target_identified", "under_preparation", "ready_for_submission"].includes(s.stage));
  return { stats: { "Projects": mine("projects").length, "Papers collected": P.length, "Papers read": P.filter((p) => ["read", "reviewed", "important"].includes(p.reading_status)).length,
      "Papers pending": P.filter((p) => ["to_read", "reading"].includes(p.reading_status)).length, "Literature reviews": mine("reviews").length, "Research gaps": mine("gaps").length,
      "Questions finalized": mine("questions").filter((q) => q.status === "finalized").length, "Datasets": mine("datasets").length,
      "Experiments completed": mine("experiments").filter((e) => e.status === "completed").length, "Writing progress %": sec.length ? Math.round(sec.reduce((a, s) => a + (s.completion || 0), 0) / sec.length) : 0,
      "Conference submissions": started.filter((s) => vt(s.venue) === "conference").length, "Journal submissions": started.filter((s) => vt(s.venue) === "journal").length,
      "Accepted / published": S.filter((s) => ["accepted", "published"].includes(s.stage)).length, "Rejected": S.filter((s) => s.stage === "rejected").length },
    reading: count(P, "reading_status"), publications: count(S, "stage"), tasks: count(T, "status"), weekly,
    upcoming: T.filter((t) => t.status !== "completed" && t.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6).map((t) => ({ title: t.title, due: t.due_date })),
    gantt: T.filter((t) => t.start_date && t.due_date).map((t) => ({ title: t.title, s: t.start_date, e: t.due_date, p: t.progress || 0 })),
    activity: db.activity.filter((a) => a.owner === u.id).slice(-8).reverse() };
}
const csvCell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- request handler ----------
async function api(req, res, url, parts) {
  const m = req.method, ip = req.socket.remoteAddress;
  if (parts[1] === "modules") return send(res, 200, MODULES);
  if (parts[1] === "register" && m === "POST") {
    const d = JSON.parse((await body(req)) || "{}"), name = String(d.username || "").trim();
    if (name.length < 3 || String(d.password || "").length < 8) return send(res, 400, { error: "Username 3+ chars and password 8+ chars required." });
    if (db.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) return send(res, 400, { error: "Username already taken." });
    const salt = crypto.randomBytes(16).toString("hex"), u = { id: ++db.seq, username: name, salt, pw: hash(d.password, salt), admin: db.users.length === 0 };
    db.users.push(u); save(); return send(res, 201, { token: makeToken(u), username: u.username });
  }
  if (parts[1] === "login" && m === "POST") {
    if (limited(ip)) return send(res, 429, { error: "Too many attempts. Wait a minute." });
    const d = JSON.parse((await body(req)) || "{}"), u = db.users.find((x) => x.username.toLowerCase() === String(d.username || "").toLowerCase());
    if (!u || !crypto.timingSafeEqual(Buffer.from(hash(String(d.password || ""), u.salt)), Buffer.from(u.pw))) return send(res, 401, { error: "Wrong username or password." });
    return send(res, 200, { token: makeToken(u), username: u.username });
  }
  const t = readToken((req.headers.authorization || "").replace("Bearer ", "")), user = t && db.users.find((u) => u.id === t.id);
  if (!user) return send(res, 401, { error: "Please log in." });
  const c = parts[1], mine = (cc) => db[cc].filter((r) => r.owner === user.id);

  if (c === "me") return send(res, 200, { username: user.username, admin: user.admin });
  if (c === "dashboard") return send(res, 200, dashboard(user));
  if (c === "search") {
    const q = norm(url.searchParams.get("q")), out = [];
    if (q.length >= 2) for (const [k, mod] of Object.entries(MODULES)) { const tf = mod.fields.find((f) => f.type === "text" && f.required) || mod.fields[0];
      for (const r of mine(k)) if (norm(Object.values(r).filter((v) => typeof v === "string").join(" ")).includes(q)) out.push({ type: k, id: r.id, title: String(r[tf.name] || "").slice(0, 120) }); }
    return send(res, 200, out.slice(0, 100));
  }
  if (c === "bibtex") { // built only from fields you typed; nothing invented
    const txt = mine("papers").map((p) => { const L = [`@${p.pub_type === "conference" ? "inproceedings" : "article"}{paper${p.id},`, `  title = {${p.title}},`];
      if (p.authors) L.push(`  author = {${p.authors.split(";").map((a) => a.trim()).filter(Boolean).join(" and ")}},`);
      if (p.year) L.push(`  year = {${p.year}},`); if (p.venue) L.push(`  ${p.pub_type === "conference" ? "booktitle" : "journal"} = {${p.venue}},`);
      if (p.doi) L.push(`  doi = {${p.doi}},`); if (p.url) L.push(`  url = {${p.url}},`); return L.join("\n") + "\n}"; }).join("\n\n");
    return send(res, 200, txt, "text/plain", { "Content-Disposition": 'attachment; filename="references.bib"' });
  }
  if (c === "backup") {
    if (!user.admin) return send(res, 403, { error: "Admin (first registered user) only." });
    const { users, ...rest } = db; return send(res, 200, JSON.stringify(rest, null, 1), "application/json", { "Content-Disposition": 'attachment; filename="researchpilot_backup.json"' });
  }
  if (c === "export" && MODULES[parts[2]]) { const mod = MODULES[parts[2]], cols = ["id", ...mod.fields.map((f) => f.name)];
    const csv = [cols.join(","), ...mine(parts[2]).map((r) => cols.map((k) => csvCell(r[k])).join(","))].join("\r\n");
    return send(res, 200, "\ufeff" + csv, "text/csv; charset=utf-8", { "Content-Disposition": `attachment; filename="${parts[2]}.csv"` }); }
  if (c === "manuscripts" && parts[3] === "doc") { // opens in Microsoft Word
    const ms = mine("manuscripts").find((r) => r.id === +parts[2]); if (!ms) return send(res, 404, { error: "Not found" });
    const html = `<html><head><meta charset="utf-8"></head><body><h1>${esc(ms.title)}</h1>` + mine("sections").filter((s) => s.manuscript === ms.id && s.content && s.name !== "Title").sort((a, b) => a.order - b.order)
      .map((s) => `<h2>${esc(s.name)}</h2><p>${esc(s.content).replace(/\n/g, "<br>")}</p>`).join("") + "</body></html>";
    return send(res, 200, html, "application/msword", { "Content-Disposition": `attachment; filename="manuscript-${ms.id}.doc"` });
  }
  if (c === "papers" && parts[3] === "file") {
    const p = mine("papers").find((r) => r.id === +parts[2]); if (!p) return send(res, 404, { error: "Not found" });
    if (m === "GET") { if (!p.file) return send(res, 404, { error: "No file" }); res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${path.basename(p.fileName || "paper.pdf")}"` }); return fs.createReadStream(path.join(UP, p.file)).pipe(res); }
    if (m === "PUT") { const name = decodeURIComponent(req.headers["x-filename"] || "paper.pdf"); if (!/\.pdf$/i.test(name)) return send(res, 400, { error: "Only PDF files allowed." });
      let buf; try { buf = await body(req, 20 * 1048576); } catch { return send(res, 413, { error: "File larger than 20 MB." }); }
      if (buf.slice(0, 5).toString() !== "%PDF-") return send(res, 400, { error: "That file is not a real PDF." });
      if (p.file) fs.rmSync(path.join(UP, p.file), { force: true }); p.file = crypto.randomUUID() + ".pdf"; p.fileName = name.slice(0, 150);
      fs.writeFileSync(path.join(UP, p.file), buf); log(user, "uploaded", "paper", p.title); save(); return send(res, 200, { ok: true }); }
  }
  if (!MODULES[c]) return send(res, 404, { error: "Unknown endpoint" });

  const id = parts[2] ? +parts[2] : null;
  if (m === "GET" && !id) {
    let rows = mine(c); const q = norm(url.searchParams.get("q"));
    for (const f of MODULES[c].fields) { const v = url.searchParams.get(f.name); if (v) rows = rows.filter((r) => String(r[f.name]) === v); }
    if (q) rows = rows.filter((r) => norm(Object.values(r).filter((v) => typeof v === "string").join(" ")).includes(q));
    return send(res, 200, rows.slice().reverse());
  }
  if (m === "POST" && !id) {
    if (MODULES[c].noCreate) return send(res, 400, { error: "Cannot create here." });
    const { out, errs } = clean(c, JSON.parse((await body(req)) || "{}"), user); if (errs.length) return send(res, 400, { error: errs.join("; ") });
    const row = { id: ++db.seq, owner: user.id, ...out, created: new Date().toISOString() }; db[c].push(row);
    if (c === "manuscripts") ["Title", "Abstract", "Keywords", "Introduction", "Literature Review", "Research Gap", "Problem Statement", "Proposed Methodology", "Mathematical Formulation",
      "Experimental Setup", "Results and Discussion", "Conclusion", "Future Work", "References"].forEach((n, i) => db.sections.push({ id: ++db.seq, owner: user.id, manuscript: row.id, name: n, order: i, content: "", completion: 0, notes: "", review_status: "draft" }));
    log(user, "created", c, out.title || out.name || out.text || out.code || row.id); save(); return send(res, 201, row);
  }
  const row = id && mine(c).find((r) => r.id === id); if (id && !row) return send(res, 404, { error: "Not found" });
  if (m === "PUT" && row) { const { out, errs } = clean(c, JSON.parse((await body(req)) || "{}"), user, row); if (errs.length) return send(res, 400, { error: errs.join("; ") });
    Object.assign(row, out); log(user, "updated", c, out.title || out.name || row.id); save(); return send(res, 200, row); }
  if (m === "DELETE" && row) { if (row.file) fs.rmSync(path.join(UP, row.file), { force: true }); log(user, "deleted", c, row.title || row.name || row.id); removeRow(c, id); save(); return send(res, 200, { ok: true }); }
  send(res, 405, { error: "Method not allowed" });
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x"), parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
    if (parts[0] === "api") return await api(req, res, url, parts);
    const f = path.normalize(path.join(PUB, parts.length ? parts.join("/") : "index.html"));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(res, 404, "Not found", "text/plain");
    send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || "application/octet-stream");
  } catch (e) { console.error(e); send(res, 500, { error: "Server error: " + e.message }); }
}).listen(PORT, () => console.log(`ResearchPilot running at http://localhost:${PORT}`));
