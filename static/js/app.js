let allData = [];
let filteredData = [];
let currentTokens = [];
let currentDetail = null;
let currentPage = 1;
const PAGE_SIZE = 50;
let searchQuery = "";
let hideAllIconsGlobal = false;

let currentSort = "sujet_asc";

// ==================== API ====================

async function apiGetAll() {
  const res = await fetch("/api/sequences");
  if (!res.ok) throw new Error("Impossible de charger les séquences.");
  return await res.json();
}

async function apiSearch(query) {
  const res = await fetch(`/api/sequences/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Erreur de recherche.");
  return await res.json();
}

async function apiCreate(payload) {
  const res = await fetch("/api/sequences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de la création.");
  return data;
}

async function apiUpdate(id, payload) {
  const res = await fetch(`/api/sequences/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de la modification.");
  return data;
}

async function apiDelete(id) {
  const res = await fetch(`/api/sequences/${id}`, {
    method: "DELETE"
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression.");
  return data;
}

// ==================== UTILS ====================

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenize(text) {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function isImageUrl(str) {
  if (!str) return false;
  return /^https?:\/\/.+/i.test(str) || /^data:image\//i.test(str);
}

function isHiddenIconValue(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function getIcon(row) {
  if (hideAllIconsGlobal) return "";
  if (isHiddenIconValue(row.masquer_icone)) return "";
  if (row.icone && String(row.icone).trim()) return String(row.icone).trim();
  return "✨";
}

function renderIcon(icon) {
  if (!icon) return "";
  if (isImageUrl(icon)) {
    return `<img src="${esc(icon)}" class="sn-icon-img" alt="icon">`;
  }
  return `<span class="sn-icon">${esc(icon)}</span>`;
}

function highlightText(text, tokens) {
  const raw = String(text ?? "");
  if (!raw || !tokens?.length) return esc(raw);

  const escaped = esc(raw);
  let result = escaped;

  tokens.forEach((token) => {
    if (!token) return;
    const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${safeToken})`, "gi");
    result = result.replace(regex, "<mark>$1</mark>");
  });

  return result;
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "fr", { sensitivity: "base" });
}

function sortRows(rows, sortMode) {
  const data = [...rows];

  switch (sortMode) {
    case "id_asc":
      return data.sort((a, b) => Number(a.id) - Number(b.id));

    case "id_desc":
      return data.sort((a, b) => Number(b.id) - Number(a.id));

    case "sn_asc":
      return data.sort((a, b) => compareText(a.sn, b.sn));

    case "sn_desc":
      return data.sort((a, b) => compareText(b.sn, a.sn));

    case "sujet_asc":
      return data.sort((a, b) => compareText(a.sujet, b.sujet));

    case "sujet_desc":
      return data.sort((a, b) => compareText(b.sujet, a.sujet));

    case "source_asc":
      return data.sort((a, b) => compareText(a.source, b.source));

    case "source_desc":
      return data.sort((a, b) => compareText(b.source, a.source));

    default:
      return data;
  }
}

function showField(wrapperId, valueId, value) {
  const wrapper = document.getElementById(wrapperId);
  const target = document.getElementById(valueId);
  if (!wrapper || !target) return;

  if (value && String(value).trim()) {
    target.textContent = value;
    wrapper.style.display = "block";
  } else {
    wrapper.style.display = "none";
    target.textContent = "";
  }
}

function getAddPayload() {
  return {
    sn: document.getElementById("f_sn").value.trim(),
    sujet: document.getElementById("f_sujet").value.trim(),
    mots_cles: document.getElementById("f_mots").value.trim(),
    description: document.getElementById("f_desc").value.trim(),
    source: document.getElementById("f_source").value.trim(),
    plantes: document.getElementById("f_plantes").value.trim(),
    icone: document.getElementById("f_icone").value.trim(),
    masquer_icone: document.getElementById("f_masquer_icone").checked ? "1" : "0"
  };
}

function getEditPayload() {
  return {
    sn: document.getElementById("e_sn").value.trim(),
    sujet: document.getElementById("e_sujet").value.trim(),
    mots_cles: document.getElementById("e_mots").value.trim(),
    description: document.getElementById("e_desc").value.trim(),
    source: document.getElementById("e_source").value.trim(),
    plantes: document.getElementById("e_plantes").value.trim(),
    icone: document.getElementById("e_icone").value.trim(),
    masquer_icone: document.getElementById("e_masquer_icone").checked ? "1" : "0"
  };
}

function resetAddForm() {
  ["f_sn", "f_sujet", "f_mots", "f_desc", "f_source", "f_plantes", "f_icone"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const chk = document.getElementById("f_masquer_icone");
  if (chk) chk.checked = false;

  const fb = document.getElementById("addFeedback");
  fb.className = "form-feedback";
  fb.textContent = "";
}

function showAddFeedback(message, ok = true) {
  const fb = document.getElementById("addFeedback");
  fb.textContent = message;
  fb.className = `form-feedback show ${ok ? "ok" : "err"}`;
}

function showPanelFeedback(message, ok = true) {
  const fb = document.getElementById("panelFeedback");
  fb.textContent = message;
  fb.className = `form-feedback show ${ok ? "ok" : "err"}`;
}

function closeAddForm() {
  document.getElementById("addForm").classList.remove("open");
  document.getElementById("addToggle").textContent = "+ Ajouter une SN";
}

function openAddForm() {
  document.getElementById("addForm").classList.add("open");
  document.getElementById("addToggle").textContent = "− Fermer";
}

function setViewMode() {
  document.getElementById("panelViewMode").style.display = "block";
  document.getElementById("panelEditMode").style.display = "none";
  document.getElementById("viewModeButtons").style.display = "flex";
  document.getElementById("editModeButtons").style.display = "none";
  document.getElementById("delConfirm").classList.remove("show");
  resetPanelFeedback();
}

function setEditMode() {
  document.getElementById("panelViewMode").style.display = "none";
  document.getElementById("panelEditMode").style.display = "block";
  document.getElementById("viewModeButtons").style.display = "none";
  document.getElementById("editModeButtons").style.display = "flex";
  resetPanelFeedback();
}

function resetPanelFeedback() {
  const fb = document.getElementById("panelFeedback");
  if (!fb) return;
  fb.className = "form-feedback";
  fb.textContent = "";
}

function fillEditForm(item) {
  document.getElementById("e_sn").value = item.sn || "";
  document.getElementById("e_sujet").value = item.sujet || "";
  document.getElementById("e_mots").value = item.mots_cles || "";
  document.getElementById("e_desc").value = item.description || "";
  document.getElementById("e_source").value = item.source || "";
  document.getElementById("e_plantes").value = item.plantes || "";
  document.getElementById("e_icone").value = item.icone || "";
  document.getElementById("e_masquer_icone").checked = isHiddenIconValue(item.masquer_icone);
}

function fillDetail(item) {
  currentDetail = item;

  const icon = renderIcon(getIcon(item));
  document.getElementById("d_sn").innerHTML = `${icon} ${esc(item.sn || "—")}`;
  document.getElementById("d_sujet").textContent = item.sujet || "—";

  showField("d_mots_wrap", "d_mots", item.mots_cles);
  showField("d_desc_wrap", "d_desc", item.description);
  showField("d_source_wrap", "d_source", item.source);
  showField("d_plantes_wrap", "d_plantes", item.plantes);

  document.getElementById("d_hr1").style.display =
    item.mots_cles || item.description || item.source || item.plantes ? "block" : "none";
}

function openDetail(id) {
  const item = allData.find((x) => Number(x.id) === Number(id));
  if (!item) return;

  fillDetail(item);
  setViewMode();
  document.getElementById("overlay").classList.add("open");
}

function closeDetail() {
  document.getElementById("overlay").classList.remove("open");
}

// ==================== RENDER ====================

function render() {
  const list = document.getElementById("bddList");
  const resultCount = document.getElementById("resultCount");
  const totalCount = document.getElementById("totalCount");
  const loadMore = document.getElementById("loadMore");

  const sortedRows = sortRows(filteredData, currentSort);
  const visibleRows = sortedRows.slice(0, currentPage * PAGE_SIZE);

  resultCount.textContent = filteredData.length.toLocaleString("fr");
  totalCount.textContent = allData.length.toLocaleString("fr");

  if (!filteredData.length) {
    list.innerHTML = `<div class="no-results">Aucun résultat.</div>`;
    loadMore.style.display = "none";
    return;
  }

  list.innerHTML = visibleRows.map((row) => {
    const iconHtml = renderIcon(getIcon(row));
    return `
      <div class="bdd-row" data-id="${row.id}">
        <div class="cell cell-sn">${iconHtml} ${highlightText(row.sn || "", currentTokens)}</div>
        <div class="cell cell-sujet">${highlightText(row.sujet || "", currentTokens)}</div>
        <div class="cell cell-desc">${highlightText((row.description || "").substring(0, 140), currentTokens)}</div>
        <div class="cell cell-source">${highlightText(row.source || "", currentTokens)}</div>
        <div class="cell cell-action"></div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".bdd-row").forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      openDetail(rowEl.dataset.id);
    });
  });

  loadMore.style.display = visibleRows.length < filteredData.length ? "block" : "none";
}

// ==================== DATA ====================

async function refreshData(preserveQuery = true) {
  const data = await apiGetAll();
  allData = data;

  if (preserveQuery && searchQuery.trim()) {
    await performSearch(searchQuery.trim(), false);
  } else {
    filteredData = [...allData];
    currentTokens = [];
    currentPage = 1;
    render();
  }
}

async function performSearch(query, resetPage = true) {
  searchQuery = query || "";

  if (resetPage) currentPage = 1;

  if (!searchQuery.trim()) {
    filteredData = [...allData];
    currentTokens = [];
    render();
    return;
  }

  const result = await apiSearch(searchQuery.trim());
  filteredData = result.results || [];
  currentTokens = result.tokens || tokenize(searchQuery);
  render();
}

// ==================== ACTIONS ====================

async function handleAdd() {
  try {
    const payload = getAddPayload();

    if (!payload.sn || !payload.sujet) {
      showAddFeedback("⚠ SN et Sujet sont requis.", false);
      return;
    }

    await apiCreate(payload);
    resetAddForm();
    showAddFeedback("✓ Séquence ajoutée avec succès.", true);

    await refreshData(true);
    closeAddForm();
  } catch (err) {
    showAddFeedback(err.message || "Erreur lors de l’ajout.", false);
  }
}

async function handleSaveEdit() {
  try {
    if (!currentDetail?.id) return;

    const payload = getEditPayload();

    if (!payload.sn || !payload.sujet) {
      showPanelFeedback("⚠ SN et Sujet sont requis.", false);
      return;
    }

    const updated = await apiUpdate(currentDetail.id, payload);
    await refreshData(true);
    fillDetail(updated);
    fillEditForm(updated);
    setViewMode();
  } catch (err) {
    showPanelFeedback(err.message || "Erreur lors de la modification.", false);
  }
}

async function handleDeleteCurrent() {
  try {
    if (!currentDetail?.id) return;
    await apiDelete(currentDetail.id);
    await refreshData(true);
    closeDetail();
  } catch (err) {
    alert(err.message || "Erreur lors de la suppression.");
  }
}

function exportCSV() {
  const rows = filteredData.length ? filteredData : allData;
  const headers = ["id", "sn", "sujet", "mots_cles", "description", "source", "plantes", "icone", "masquer_icone"];

  const csv = [
    headers.join(";"),
    ...rows.map((row) =>
      headers.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(";")
    )
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "GG_sequences_export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== EVENTS ====================

// document.getElementById("sortSelect").addEventListener("change", (e) => {
//   currentSort = e.target.value;
//   currentPage = 1;
//   render();
// });

document.getElementById("searchInput").addEventListener("input", (e) => {
  clearTimeout(window.__searchTimer);
  window.__searchTimer = setTimeout(() => {
    performSearch(e.target.value);
  }, 180);
});

document.getElementById("hideAllIcons").addEventListener("change", (e) => {
  hideAllIconsGlobal = e.target.checked;
  render();
});

document.getElementById("addToggle").addEventListener("click", () => {
  const form = document.getElementById("addForm");
  const isOpen = form.classList.contains("open");

  if (isOpen) {
    closeAddForm();
  } else {
    resetAddForm();
    openAddForm();
  }
});

document.getElementById("btnCancel").addEventListener("click", () => {
  resetAddForm();
  closeAddForm();
});

document.getElementById("btnAdd").addEventListener("click", handleAdd);

document.getElementById("btnExport")?.addEventListener("click", exportCSV);

document.getElementById("btnLoadMore")?.addEventListener("click", () => {
  currentPage += 1;
  render();
});

document.getElementById("panelClose").addEventListener("click", closeDetail);

document.getElementById("overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeDetail();
});

document.getElementById("btnPanelEdit").addEventListener("click", () => {
  if (!currentDetail) return;
  fillEditForm(currentDetail);
  setEditMode();
});

document.getElementById("btnPanelCancel").addEventListener("click", () => {
  setViewMode();
});

document.getElementById("btnPanelSave").addEventListener("click", handleSaveEdit);

document.getElementById("btnPanelDelete").addEventListener("click", () => {
  document.getElementById("delConfirm").classList.add("show");
});

document.getElementById("btnDelNo").addEventListener("click", () => {
  document.getElementById("delConfirm").classList.remove("show");
});

document.getElementById("btnDelYes").addEventListener("click", handleDeleteCurrent);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetail();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    document.getElementById("searchInput").focus();
  }
});

// ==================== INIT ====================

window.addEventListener("load", async () => {
  try {
    await refreshData(false);
  } catch (err) {
    console.error(err);
    document.getElementById("bddList").innerHTML =
      `<div class="no-results">Erreur de chargement des données.</div>`;
  }
});