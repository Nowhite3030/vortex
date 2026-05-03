const STORAGE_KEY = "vortex_warehouse_items_v2";
const LOG_KEY = "vortex_warehouse_logs_v2";

const itemForm = document.getElementById("itemForm"),
  itemName = document.getElementById("itemName"),
  itemCategory = document.getElementById("itemCategory"),
  itemQuantity = document.getElementById("itemQuantity"),
  itemImage = document.getElementById("itemImage"),
  previewBox = document.getElementById("previewBox"),
  imageInfo = document.getElementById("imageInfo"),
  itemGrid = document.getElementById("itemGrid"),
  searchInput = document.getElementById("searchInput"),
  logList = document.getElementById("logList"),
  clearLogBtn = document.getElementById("clearLogBtn"),
  exportBtn = document.getElementById("exportBtn"),
  template = document.getElementById("itemCardTemplate"),
  logPermissionHint = document.getElementById("logPermissionHint");

const cropModal = document.getElementById("cropModal"),
  cropCanvas = document.getElementById("cropCanvas"),
  cropInfo = document.getElementById("cropInfo"),
  cropConfirmBtn = document.getElementById("cropConfirmBtn"),
  cropCancelBtn = document.getElementById("cropCancelBtn"),
  cropCancelTopBtn = document.getElementById("cropCancelTopBtn"),
  cropFullBtn = document.getElementById("cropFullBtn"),
  cropCtx = cropCanvas.getContext("2d");

let imageBase64 = "",
  imageMeta = null,
  items = loadData(STORAGE_KEY),
  logs = loadData(LOG_KEY);

let cropState = {
  file: null,
  sourceImage: null,
  originalDataUrl: "",
  selection: null,
  isDragging: false,
  startX: 0,
  startY: 0
};

/* ================= 基本工具 ================= */

function loadData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}

/* ================= 圖片資訊 ================= */

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function formatImageMeta(meta) {
  if (!meta) return "圖片資訊：無圖片";

  const croppedText = meta.cropped
    ? `，原圖 ${meta.originalWidth} × ${meta.originalHeight}px`
    : "";

  return `圖片資訊：${meta.width} × ${meta.height}px，${formatFileSize(meta.fileSize)}${croppedText}`;
}

function resetImageInput() {
  imageBase64 = "";
  imageMeta = null;
  itemImage.value = "";
  previewBox.innerHTML = "<span>圖片預覽</span>";
  imageInfo.textContent = "尚未選擇圖片";
}

/* ================= 紀錄 ================= */

function addLog(text) {
  const user = window.Auth.getCurrentUser();
  const now = new Date().toLocaleString("zh-TW", { hour12: false });

  logs.unshift(`${now}｜${user?.displayName || "未知人員"}｜${text}`);
  logs = logs.slice(0, 150);

  saveData();
  renderLogs();
}

/* ================= 權限 ================= */

function applyRoleVisibility() {
  const admin = window.Auth.isAdmin();

  document.querySelectorAll(".role-admin-only").forEach(el => {
    el.style.display = admin ? "" : "none";
  });

  logPermissionHint.textContent = admin
    ? ""
    : "目前身分組不可刪除物品或清空紀錄。";
}

/* ================= 渲染物品 ================= */

function renderItems() {
  const keyword = searchInput.value.trim().toLowerCase();

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(keyword) ||
    (i.category || "").toLowerCase().includes(keyword)
  );

  itemGrid.innerHTML = "";

  if (!filtered.length) {
    itemGrid.innerHTML = '<div class="empty-text">目前沒有符合條件的物品</div>';
    return;
  }

  filtered.forEach(item => {
    const card = template.content.cloneNode(true);

    const imageWrap = card.querySelector(".image-wrap"),
      title = card.querySelector("h3"),
      category = card.querySelector(".category"),
      stock = card.querySelector(".stock"),
      imageMetaText = card.querySelector(".image-meta"),
      adjustInput = card.querySelector(".adjust-input"),
      takeBtn = card.querySelector(".take-btn"),
      addBtn = card.querySelector(".add-btn"),
      deleteBtn = card.querySelector(".delete-btn");

    imageWrap.innerHTML = item.image
      ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">`
      : "無圖片";

    title.textContent = item.name;
    category.textContent = item.category
      ? `分類：${item.category}`
      : "分類：未分類";

    stock.textContent = `目前庫存：${item.quantity}`;

    if (item.quantity <= 5) {
      stock.classList.add("low");
    }

    imageMetaText.textContent = formatImageMeta(item.imageMeta);

    takeBtn.onclick = () =>
      adjustQuantity(item.id, -Number(adjustInput.value || 0));

    addBtn.onclick = () =>
      adjustQuantity(item.id, Number(adjustInput.value || 0));

    deleteBtn.onclick = () => deleteItem(item.id);

    itemGrid.appendChild(card);
  });

  applyRoleVisibility();
}

/* ================= 渲染紀錄 ================= */

function renderLogs() {
  logList.innerHTML = "";

  if (!logs.length) {
    logList.innerHTML = "<li>尚無操作紀錄</li>";
    return;
  }

  logs.forEach(log => {
    const li = document.createElement("li");
    li.textContent = log;
    logList.appendChild(li);
  });

  applyRoleVisibility();
}

/* ================= 操作 ================= */

function adjustQuantity(id, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("請輸入正確數量");
    return;
  }

  const item = items.find(i => i.id === id);
  if (!item) return;

  if (amount < 0 && item.quantity + amount < 0) {
    alert("庫存不足，無法提取");
    return;
  }

  item.quantity += amount;

  addLog(`${amount > 0 ? "補充" : "提取"}「${item.name}」${Math.abs(amount)} 個，剩餘 ${item.quantity}`);

  saveData();
  renderItems();
}

function deleteItem(id) {
  if (!window.Auth.isAdmin()) {
    alert("只有管理員身分組可以刪除物品。");
    return;
  }

  const item = items.find(i => i.id === id);
  if (!item) return;

  if (!confirm(`確定刪除「${item.name}」？`)) return;

  items = items.filter(i => i.id !== id);

  addLog(`刪除物品「${item.name}」`);

  saveData();
  renderItems();
}

/* ================= 事件 ================= */

itemForm.addEventListener("submit", e => {
  e.preventDefault();

  const name = itemName.value.trim();
  if (!name) return;

  const item = {
    id: createId(),
    name,
    category: itemCategory.value.trim(),
    quantity: Number(itemQuantity.value || 0),
    image: imageBase64,
    imageMeta,
    createdAt: new Date().toISOString()
  };

  items.unshift(item);

  addLog(`新增物品「${name}」，數量 ${item.quantity}`);

  saveData();
  renderItems();

  itemForm.reset();
  itemQuantity.value = 0;
  resetImageInput();
});

searchInput.addEventListener("input", renderItems);

/* ================= 初始化 ================= */

renderItems();
renderLogs();
applyRoleVisibility();
