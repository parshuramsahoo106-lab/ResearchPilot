// ResearchPilot frontend: plain JavaScript + Bootstrap. Forms/tables are generated from /api/modules.
let M = {}, token = localStorage.token || "", charts = [];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const label = (s) => String(s).replace(/_/g, " ");

async function api(path, opt = {}) {
  const res = await fetch("/api" + path, { ...opt, headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(opt.raw ? {} : { "Content-Type": "application/json" }), ...opt.headers } });
  if (opt.blob) { if (!res.ok) throw new Error((await res.json()).error); return res.blob(); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { logout(); return; }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function logout() { localStorage.removeItem("token"); token = ""; location.hash = "#/login"; render(); }
async function download(path, name) { const b = await api(path, { blob: true }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); }
function toast(msg, ok = true) { const d = document.createElement("div"); d.className = `alert alert-${ok ? "success" : "danger"} position-fixed top-0 end-0 m-3`; d.style.zIndex = 3000; d.textContent = msg; document.body.append(d); setTimeout(() => d.remove(), 3500); }

const NAV = [["dashboard", "Dashboard"], ["m/projects", "My Research Projects"], ["m/papers", "Research Papers"], ["m/reviews", "Literature Review"], ["m/gaps", "Research Gaps"],
  ["m/questions", "Research Questions"], ["methodology", "Methodology & Diagram"], ["m/datasets", "Datasets"], ["m/experiments", "Experiments"], ["compare", "Experiment Comparison"],
  ["m/tasks", "Tasks & Timeline"], ["m/manuscripts", "Paper Writing"], ["m/venues", "Journals & Conferences"], ["m/submissions", "Submissions"], ["m/meetings", "Supervisor Meetings"],
  ["m/notes", "Research Notes"], ["settings", "Settings & Backup"]];
const RELATED = ["hypotheses", "methodologies", "agents", "results", "sections"];

async function render() {
  charts.forEach((c) => c.destroy()); charts = [];
  const route = (location.hash.slice(2) || "dashboard").split("?")[0];
  if (!token) return loginView();
  if (!Object.keys(M).length) M = await api("/modules");
  const cur = route;
  $("#app").innerHTML = `<div class="d-md-flex">
    <aside class="sidebar p-2" id="side"><div class="fs-5 fw-bold px-2 mb-2">🧭 ResearchPilot</div>
      ${NAV.map(([h, t]) => `<a class="nav-link ${cur === h ? "active" : ""}" href="#/${h}">${t}</a>`).join("")}
      <div class="text-secondary small px-2 mt-2">Related records</div>
      ${RELATED.map((k) => `<a class="nav-link ps-4 ${cur === "m/" + k ? "active" : ""}" href="#/m/${k}">${M[k].title}</a>`).join("")}</aside>
    <div class="flex-grow-1 min-w-0">
      <header class="d-flex gap-2 align-items-center p-2 border-bottom bg-body">
        <button class="btn btn-outline-secondary d-md-none" onclick="$('#side').classList.toggle('open')">☰</button>
        <form class="flex-grow-1" style="max-width:420px" onsubmit="event.preventDefault();location.hash='#/search?q='+encodeURIComponent(this.q.value)"><input name="q" class="form-control" placeholder="Search everything…"></form>
        <button class="btn btn-outline-secondary" onclick="toggleTheme()">🌓</button><button class="btn btn-outline-secondary" onclick="logout()">Log out</button></header>
      <main class="p-3" id="view">Loading…</main></div></div>`;
  try {
    if (route === "dashboard") await dashboardView();
    else if (route.startsWith("m/") && M[route.slice(2)]) await moduleView(route.slice(2));
    else if (route === "methodology") await methodologyView();
    else if (route === "compare") await compareView();
    else if (route === "settings") await settingsView();
    else if (route === "search") await searchView();
    else location.hash = "#/dashboard";
  } catch (e) { $("#view").innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`; }
}
function toggleTheme() { const h = document.documentElement; h.dataset.bsTheme = h.dataset.bsTheme === "dark" ? "light" : "dark"; localStorage.theme = h.dataset.bsTheme; }
document.documentElement.dataset.bsTheme = localStorage.theme || "light";
window.addEventListener("hashchange", render);

function loginView() {
  let reg = false;
  const draw = (msg = "") => { $("#app").innerHTML = `<div class="d-flex justify-content-center align-items-center" style="min-height:100vh"><form id="lf" class="card p-4" style="width:340px">
    <h3>ResearchPilot</h3><p class="text-secondary small">${reg ? "Create your account" : "Log in to your research workspace"}</p>
    <input class="form-control mb-2" name="username" placeholder="Username" required><input class="form-control mb-2" type="password" name="password" placeholder="Password (8+ characters)" required>
    ${msg ? `<div class="text-danger small mb-2">${esc(msg)}</div>` : ""}<button class="btn btn-primary mb-2">${reg ? "Register" : "Log in"}</button>
    <a href="#" id="sw" class="small">${reg ? "Have an account? Log in" : "No account? Register"}</a></form></div>`;
    $("#sw").onclick = (e) => { e.preventDefault(); reg = !reg; draw(); };
    $("#lf").onsubmit = async (e) => { e.preventDefault(); const f = e.target;
      try { const r = await api(reg ? "/register" : "/login", { method: "POST", body: JSON.stringify({ username: f.username.value, password: f.password.value }) });
        token = localStorage.token = r.token; location.hash = "#/dashboard"; render(); } catch (x) { draw(x.message); } };
  };
  draw();
}

const mkChart = (id, type, labels, data, title) => charts.push(new Chart($("#" + id), { type, data: { labels, datasets: [{ label: title, data, backgroundColor: ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#64748b", "#84cc16", "#ec4899"], borderColor: "#4f46e5" }] },
  options: { maintainAspectRatio: false, plugins: { legend: { display: type === "pie" } }, scales: type === "pie" ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } } } }));

async function dashboardView() {
  const d = await api("/dashboard"), box = (id, t) => `<div class="col-md-6 col-xl-4"><div class="card p-3"><h6>${t}</h6><div class="chart-box"><canvas id="${id}"></canvas></div></div></div>`;
  let g = "";
  if (d.gantt.length) { const a = Math.min(...d.gantt.map((x) => +new Date(x.s))), b = Math.max(...d.gantt.map((x) => +new Date(x.e))), span = Math.max(b - a, 864e5);
    g = d.gantt.map((x) => `<div class="d-flex align-items-center small mb-1"><div style="width:160px" class="text-truncate">${esc(x.title)}</div><div class="flex-grow-1 position-relative" style="height:18px;background:var(--bs-secondary-bg)"><div class="gantt-bar" style="left:${((+new Date(x.s) - a) / span) * 100}%;width:${Math.max(((+new Date(x.e) - +new Date(x.s)) / span) * 100, 3)}%">${x.p}%</div></div></div>`).join(""); }
  else g = `<span class="text-secondary small">Add tasks with a start date and deadline to see the timeline.</span>`;
  $("#view").innerHTML = `<h4>Dashboard</h4><div class="row g-2 mb-3">${Object.entries(d.stats).map(([k, v]) => `<div class="col-6 col-md-3 col-xl-2"><div class="card p-2"><div class="stat">${v}</div><div class="small text-secondary">${k}</div></div></div>`).join("")}</div>
    <div class="row g-3">${box("c1", "Paper reading progress")}${box("c2", "Publication status")}${box("c3", "Research progress (tasks)")}${box("c4", "Weekly research activity")}
    <div class="col-md-6 col-xl-4"><div class="card p-3"><h6>Upcoming deadlines</h6>${d.upcoming.map((t) => `<div class="d-flex justify-content-between small border-bottom py-1"><span>${esc(t.title)}</span><span class="text-secondary">${t.due}</span></div>`).join("") || '<span class="text-secondary small">None</span>'}</div></div>
    <div class="col-md-6 col-xl-4"><div class="card p-3"><h6>Recent activity</h6>${d.activity.map((a) => `<div class="small">${a.action} <b>${a.model}</b>: ${esc(a.text)}</div>`).join("") || '<span class="text-secondary small">Nothing yet</span>'}</div></div>
    <div class="col-12"><div class="card p-3"><h6>Research timeline (Gantt)</h6>${g}</div></div></div>`;
  mkChart("c1", "pie", Object.keys(d.reading).map(label), Object.values(d.reading), "Papers");
  mkChart("c2", "bar", Object.keys(d.publications).map(label), Object.values(d.publications), "Submissions");
  mkChart("c3", "bar", Object.keys(d.tasks).map(label), Object.values(d.tasks), "Tasks");
  mkChart("c4", "line", d.weekly.map((w) => w.day), d.weekly.map((w) => w.n), "Actions");
}

async function moduleView(key) {
  const mod = M[key], refs = {}, filters = {};
  for (const f of mod.fields.filter((f) => f.ref)) refs[f.ref] = refs[f.ref] || (await api("/" + f.ref));
  const rl = (f, id) => { const r = (refs[f.ref] || []).find((x) => x.id === id); return r ? String(r[f.refLabel]).slice(0, 60) : ""; };
  const cols = mod.fields.filter((f) => f.list), extra = (mod.extra || []).map((n) => mod.fields.find((f) => f.name === n));
  const shown = (f, r) => f.type === "fk" ? esc(rl(f, r[f.name])) : f.type === "checkbox" ? (r[f.name] ? "✔" : "") : f.type === "select" && r[f.name] ? `<span class="badge text-bg-primary">${label(r[f.name])}</span>` : esc(r[f.name] ?? "").slice(0, 120);
  let q = "";
  async function draw() {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }), rows = await api(`/${key}?${p}`);
    $("#rows").innerHTML = rows.map((r) => `<tr>${[...cols, ...extra].map((f) => `<td>${shown(f, r)}</td>`).join("")}<td class="text-nowrap">
      ${mod.upload && r.file ? `<button class="btn btn-sm btn-outline-secondary" data-a="pdf" data-id="${r.id}">PDF</button> ` : ""}${mod.doc ? `<button class="btn btn-sm btn-outline-secondary" data-a="doc" data-id="${r.id}">Word</button> ` : ""}
      <button class="btn btn-sm btn-outline-primary" data-a="edit" data-id="${r.id}">Edit</button> <button class="btn btn-sm btn-outline-danger" data-a="del" data-id="${r.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="99" class="text-secondary">No records yet.</td></tr>`;
    $("#rows").onclick = async (e) => { const b = e.target.closest("button"); if (!b) return; const id = +b.dataset.id, r = rows.find((x) => x.id === id);
      try { if (b.dataset.a === "edit") form(r);
        if (b.dataset.a === "del" && confirm("Delete this record permanently?")) { await api(`/${key}/${id}`, { method: "DELETE" }); draw(); }
        if (b.dataset.a === "pdf") window.open(URL.createObjectURL(await api(`/papers/${id}/file`, { blob: true })));
        if (b.dataset.a === "doc") await download(`/manuscripts/${id}/doc`, `${r.title}.doc`); } catch (x) { toast(x.message, false); } };
  }
  function form(r) {
    const f = r || {}, el = document.createElement("div");
    const inp = (x) => { const v = f[x.name] ?? "", n = `name="${x.name}"`;
      if (x.type === "textarea") return `<textarea class="form-control" rows="3" ${n}>${esc(v)}</textarea>`;
      if (x.type === "select") return `<select class="form-select" ${n}><option value="">—</option>${x.options.map((o) => `<option value="${o.value}" ${v === o.value ? "selected" : ""}>${o.label}</option>`).join("")}</select>`;
      if (x.type === "fk") return `<select class="form-select" ${n} ${x.required ? "required" : ""}><option value="">—</option>${(refs[x.ref] || []).map((o) => `<option value="${o.id}" ${v === o.id ? "selected" : ""}>${esc(String(o[x.refLabel]).slice(0, 70))}</option>`).join("")}</select>`;
      if (x.type === "checkbox") return `<input type="checkbox" class="form-check-input" ${n} ${f[x.name] ? "checked" : ""}>`;
      return `<input class="form-control" type="${x.type}" ${x.step ? `step="${x.step}"` : ""} ${n} value="${esc(v)}" ${x.required ? "required" : ""} ${x.readonlyEdit && r ? "readonly" : ""}>`; };
    el.innerHTML = `<div class="modal fade"><div class="modal-dialog modal-lg modal-dialog-scrollable"><form class="modal-content"><div class="modal-header"><h5>${r ? "Edit" : "Add"} — ${mod.title}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">${mod.fields.map((x) => `<div class="mb-2"><label class="form-label small fw-semibold">${x.label}${x.required ? " *" : ""}</label>${inp(x)}</div>`).join("")}
      ${mod.upload ? `<div class="mb-2"><label class="form-label small fw-semibold">PDF file (max 20 MB)</label><input type="file" accept=".pdf" class="form-control" id="pdf"></div>` : ""}<div class="text-danger small" id="err"></div></div>
      <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary">Save</button></div></form></div></div>`;
    $("#modalHost").innerHTML = ""; $("#modalHost").append(el); const modal = new bootstrap.Modal(el.firstChild); modal.show();
    el.querySelector("form").onsubmit = async (e) => { e.preventDefault(); const data = {};
      for (const x of mod.fields) { const i = e.target.elements[x.name]; data[x.name] = x.type === "checkbox" ? i.checked : i.value; }
      try { const saved = await api(r ? `/${key}/${r.id}` : `/${key}`, { method: r ? "PUT" : "POST", body: JSON.stringify(data) });
        const file = $("#pdf")?.files[0]; if (file) await api(`/papers/${saved.id}/file`, { method: "PUT", raw: true, body: file, headers: { "x-filename": encodeURIComponent(file.name) } });
        modal.hide(); toast("Saved"); draw(); } catch (x) { $("#err").textContent = x.message; } };
  }
  $("#view").innerHTML = `<div class="d-flex flex-wrap gap-2 align-items-center mb-2"><h4 class="me-auto mb-0">${mod.title}</h4><input id="q" class="form-control" style="width:180px" placeholder="Search…">
    ${mod.fields.filter((f) => f.filter).map((f) => `<select class="form-select" style="width:160px" data-f="${f.name}"><option value="">${f.label}: all</option>${(f.options || (refs[f.ref] || []).map((o) => ({ value: o.id, label: String(o[f.refLabel]).slice(0, 40) }))).map((o) => `<option value="${o.value}">${label(o.label)}</option>`).join("")}</select>`).join("")}
    <button class="btn btn-outline-secondary" id="csv">CSV / Excel</button>${key === "papers" ? '<button class="btn btn-outline-secondary" id="bib">BibTeX</button>' : ""}${mod.noCreate ? "" : '<button class="btn btn-primary" id="add">+ Add</button>'}</div>
    ${mod.help ? `<p class="small text-secondary">${mod.help}</p>` : ""}
    <div class="card table-responsive"><table class="table table-hover mb-0"><thead><tr>${[...cols, ...extra].map((f) => `<th>${f.label}</th>`).join("")}<th>Actions</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  $("#q").oninput = (e) => { q = e.target.value; draw(); };
  document.querySelectorAll("[data-f]").forEach((s) => (s.onchange = () => { filters[s.dataset.f] = s.value; draw(); }));
  $("#csv").onclick = () => download(`/export/${key}`, `${key}.csv`).catch((x) => toast(x.message, false));
  if ($("#bib")) $("#bib").onclick = () => download("/bibtex", "references.bib");
  if ($("#add")) $("#add").onclick = () => form(null);
  draw();
}

async function methodologyView() {
  const ms = await api("/methodologies");
  $("#view").innerHTML = `<h4>Methodology & Architecture Diagram</h4><div class="d-flex gap-2 mb-2 flex-wrap"><select id="ms" class="form-select" style="width:280px">${ms.map((m) => `<option value="${m.id}">${esc(m.name)} (${esc(m.version)})</option>`).join("")}</select>
    <a class="btn btn-outline-secondary" href="#/m/methodologies">Edit methodologies</a><a class="btn btn-outline-secondary" href="#/m/agents">Add / edit / remove agents</a>
    <button class="btn btn-outline-secondary" id="svg">Export SVG</button><button class="btn btn-outline-secondary" id="png">Export PNG</button></div>
    <p class="small text-secondary">The diagram is drawn from your agents, ordered by their "Order" number.</p><div class="card p-3 overflow-auto" id="dg"></div>`;
  async function draw() {
    const id = $("#ms").value; if (!id) return $("#dg").textContent = "Create a methodology first, then add agents.";
    const ag = (await api("/agents?methodology=" + id)).sort((a, b) => (a.order || 0) - (b.order || 0)), W = 240, H = 70, G = 30, h = ag.length * (H + G) + 20;
    if (!ag.length) return $("#dg").textContent = "No agents yet.";
    $("#dg").innerHTML = `<svg id="sv" xmlns="http://www.w3.org/2000/svg" width="${W + 40}" height="${h}" font-family="sans-serif"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="#64748b"/></marker></defs>
      ${ag.map((a, i) => { const y = 10 + i * (H + G); return `<rect x="20" y="${y}" width="${W}" height="${H}" rx="10" fill="#eef2ff" stroke="#4f46e5"/><text x="${20 + W / 2}" y="${y + 28}" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e1b4b">${esc(a.name.slice(0, 32))}</text>
      <text x="${20 + W / 2}" y="${y + 48}" text-anchor="middle" font-size="10" fill="#475569">${esc((a.responsibility || "").slice(0, 38))}</text>${i < ag.length - 1 ? `<line x1="${20 + W / 2}" y1="${y + H}" x2="${20 + W / 2}" y2="${y + H + G - 2}" stroke="#64748b" marker-end="url(#ar)"/>` : ""}`; }).join("")}</svg>`;
  }
  const txt = () => new XMLSerializer().serializeToString($("#sv")), save = (u, n) => { const a = document.createElement("a"); a.href = u; a.download = n; a.click(); };
  $("#ms").onchange = draw; $("#svg").onclick = () => $("#sv") && save(URL.createObjectURL(new Blob([txt()], { type: "image/svg+xml" })), "architecture.svg");
  $("#png").onclick = () => { if (!$("#sv")) return; const s = $("#sv"), c = document.createElement("canvas"), i = new Image(); c.width = s.getAttribute("width"); c.height = s.getAttribute("height");
    i.onload = () => { const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0); save(c.toDataURL("image/png"), "architecture.png"); }; i.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(txt()))); };
  draw();
}

async function compareView() {
  const [ex, rs] = await Promise.all([api("/experiments"), api("/results")]), metrics = M.results.fields.find((f) => f.name === "metric").options;
  $("#view").innerHTML = `<h4>Experiment Comparison</h4><div class="d-flex gap-3 mb-2"><select id="mt" class="form-select" style="width:260px">${metrics.map((m) => `<option value="${m.value}">${m.label}</option>`).join("")}</select>
    <label class="align-self-center"><input type="checkbox" id="ab"> Ablation studies only</label></div><p class="small text-secondary">Only values you entered under "Experiment Results" are plotted.</p>
    <div class="card p-3"><div class="chart-box"><canvas id="cc"></canvas></div></div><div class="card mt-3 table-responsive"><table class="table mb-0" id="ct"></table></div>`;
  const draw = () => { charts.forEach((c) => c.destroy()); charts = [];
    const rows = ex.filter((e) => !!e.is_ablation === $("#ab").checked).map((e) => ({ name: e.is_ablation ? `${e.code}: -${e.ablation_component}` : `${e.code} (${label(e.variant)})`, r: rs.filter((x) => x.experiment === e.id && x.metric === $("#mt").value) })).filter((x) => x.r.length);
    const keys = [...new Set(rows.flatMap((x) => x.r.map((y) => (y.k ? "K=" + y.k : "value"))))];
    const val = (x, k) => x.r.find((y) => (y.k ? "K=" + y.k : "value") === k)?.value ?? null, colors = ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444"];
    charts.push(new Chart($("#cc"), { type: "bar", data: { labels: rows.map((x) => x.name), datasets: keys.map((k, i) => ({ label: k, data: rows.map((x) => val(x, k)), backgroundColor: colors[i % 4] })) }, options: { maintainAspectRatio: false } }));
    $("#ct").innerHTML = `<thead><tr><th>Experiment</th>${keys.map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.name)}</td>${keys.map((k) => `<td>${val(x, k) ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody>`; };
  $("#mt").onchange = draw; $("#ab").onchange = draw; draw();
}

async function settingsView() {
  const me = await api("/me");
  $("#view").innerHTML = `<h4>Settings & Backup</h4><div class="card p-3 mb-3">Signed in as <b>${esc(me.username)}</b> ${me.admin ? '<span class="badge text-bg-primary">admin</span>' : ""}</div>
    <div class="card p-3"><b>Backup</b><p class="small">Downloads all your research data as JSON (admin = first registered user). To restore, stop the server and replace <code>data/db.json</code> with the backup <b>plus a users section</b> — or simply copy the whole <code>data</code> and <code>uploads</code> folders.</p>
    <button class="btn btn-primary" style="width:160px" id="bk">Download backup</button></div>`;
  $("#bk").onclick = () => download("/backup", "researchpilot_backup.json").catch((x) => toast(x.message, false));
}

async function searchView() {
  const q = new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "", rows = await api("/search?q=" + encodeURIComponent(q));
  $("#view").innerHTML = `<h4>Search: “${esc(q)}”</h4><div class="list-group">${rows.map((r) => `<a class="list-group-item list-group-item-action" href="#/m/${r.type}"><span class="badge text-bg-secondary me-2">${r.type}</span>${esc(r.title)}</a>`).join("") || "<p>No results.</p>"}</div>`;
}
render();
