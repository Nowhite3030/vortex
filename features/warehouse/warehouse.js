const STORAGE_KEY = "vortex_warehouse_items_v2";
const LOG_KEY = "vortex_warehouse_logs_v2";
const FIXED_IMAGE_SIZE = 300;

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

    // imageMetaText.textContent = formatImageMeta(item.imageMeta);

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

  addLog(
    `${amount > 0 ? "補充" : "提取"}「${item.name}」${Math.abs(amount)} 個，剩餘 ${item.quantity}`
  );

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

/* ================= 新增物品 ================= */

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

/* ================= 清空紀錄 ================= */

clearLogBtn.addEventListener("click", () => {
  if (!window.Auth.isAdmin()) {
    alert("只有管理員身分組可以刪除紀錄。");
    return;
  }

  if (confirm("確定清空所有操作紀錄？")) {
    logs = [];
    saveData();
    renderLogs();
  }
});

/* ================= 匯出資料 ================= */

exportBtn.addEventListener("click", () => {
  const data = {
    exportedAt: new Date().toISOString(),
    items,
    logs
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vortex-warehouse-export.json";
  a.click();

  URL.revokeObjectURL(a.href);
});

/* ================= 圖片上傳 ================= */

itemImage.addEventListener("change", e => {
  const file = e.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("請選擇圖片檔");
    resetImageInput();
    return;
  }

  const reader = new FileReader();

  reader.onload = () => openCropper(reader.result, file);
  reader.readAsDataURL(file);
});

/* ================= 裁切功能 ================= */

function openCropper(dataUrl, file) {
  const img = new Image();

  img.onload = () => {
    cropState = {
      file,
      sourceImage: img,
      originalDataUrl: dataUrl,
      selection: null,
      isDragging: false,
      startX: 0,
      startY: 0
    };

    const maxW = Math.min(760, window.innerWidth - 80);
    const ratio = Math.min(1, maxW / img.naturalWidth, 520 / img.naturalHeight);

    cropCanvas.width = Math.round(img.naturalWidth * ratio);
    cropCanvas.height = Math.round(img.naturalHeight * ratio);

    cropModal.classList.add("show");
    cropModal.setAttribute("aria-hidden", "false");

    drawCropCanvas();

    cropInfo.textContent =
      `原圖：${img.naturalWidth} × ${img.naturalHeight}px，${formatFileSize(file.size)}｜輸出：${FIXED_IMAGE_SIZE} × ${FIXED_IMAGE_SIZE}px`;
  };

  img.src = dataUrl;
}

function closeCropper() {
  cropModal.classList.remove("show");
  cropModal.setAttribute("aria-hidden", "true");
}

function drawCropCanvas() {
  const img = cropState.sourceImage;
  if (!img) return;

  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.drawImage(img, 0, 0, cropCanvas.width, cropCanvas.height);

  const s = cropState.selection;

  if (s) {
    cropCtx.fillStyle = "rgba(10, 2, 22, 0.58)";
    cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

    cropCtx.clearRect(s.x, s.y, s.w, s.h);

    cropCtx.drawImage(
      img,
      s.x * img.naturalWidth / cropCanvas.width,
      s.y * img.naturalHeight / cropCanvas.height,
      s.w * img.naturalWidth / cropCanvas.width,
      s.h * img.naturalHeight / cropCanvas.height,
      s.x,
      s.y,
      s.w,
      s.h
    );

    cropCtx.strokeStyle = "#e879f9";
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(s.x, s.y, s.w, s.h);
  }
}

function canvasPoint(e) {
  const r = cropCanvas.getBoundingClientRect();

  return {
    x: (e.clientX - r.left) * (cropCanvas.width / r.width),
    y: (e.clientY - r.top) * (cropCanvas.height / r.height)
  };
}

cropCanvas.addEventListener("mousedown", e => {
  const p = canvasPoint(e);

  cropState.isDragging = true;
  cropState.startX = p.x;
  cropState.startY = p.y;

  cropState.selection = {
    x: p.x,
    y: p.y,
    w: 1,
    h: 1
  };
});

window.addEventListener("mousemove", e => {
  if (!cropState.isDragging) return;

  const p = canvasPoint(e);

  const x = Math.max(0, Math.min(cropState.startX, p.x));
  const y = Math.max(0, Math.min(cropState.startY, p.y));
  const w = Math.min(cropCanvas.width - x, Math.abs(p.x - cropState.startX));
  const h = Math.min(cropCanvas.height - y, Math.abs(p.y - cropState.startY));

  cropState.selection = { x, y, w, h };

  cropInfo.textContent =
    `裁切範圍：約 ${Math.round(w * cropState.sourceImage.naturalWidth / cropCanvas.width)} × ${Math.round(h * cropState.sourceImage.naturalHeight / cropCanvas.height)}px｜輸出：${FIXED_IMAGE_SIZE} × ${FIXED_IMAGE_SIZE}px`;

  drawCropCanvas();
});

window.addEventListener("mouseup", () => {
  cropState.isDragging = false;
});

/* ================= 固定尺寸輸出 ================= */

function useCrop(full = false) {
  const img = cropState.sourceImage;
  if (!img) return;

  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  const s = cropState.selection;

  if (!full && s && s.w > 5 && s.h > 5) {
    sx = s.x * img.naturalWidth / cropCanvas.width;
    sy = s.y * img.naturalHeight / cropCanvas.height;
    sw = s.w * img.naturalWidth / cropCanvas.width;
    sh = s.h * img.naturalHeight / cropCanvas.height;
  }

  const FIXED = FIXED_IMAGE_SIZE;

  const out = document.createElement("canvas");
  const ctx = out.getContext("2d");

  out.width = FIXED;
  out.height = FIXED;

  // ⭐ 只做一次比例計算
  const scale = Math.max(FIXED / sw, FIXED / sh);

  const drawW = sw * scale;
  const drawH = sh * scale;

  const dx = (FIXED - drawW) / 2;
  const dy = (FIXED - drawH) / 2;

  ctx.drawImage(
    img,
    sx, sy, sw, sh,
    dx, dy, drawW, drawH
  );

  // ⭐ 唯一來源
  imageBase64 = out.toDataURL("image/png");

  imageMeta = {
    width: FIXED,
    height: FIXED,
    fileSize: Math.round(imageBase64.length * 0.75),
    originalWidth: img.naturalWidth,
    originalHeight: img.naturalHeight,
    cropped: !full && !!s
  };

  // ⭐ 預覽 = 最終圖（關鍵）
  previewBox.innerHTML = `<img src="${imageBase64}">`;

  // imageInfo.textContent = formatImageMeta(imageMeta);

  closeCropper();
}

cropConfirmBtn.onclick = () => useCrop(false);
cropFullBtn.onclick = () => useCrop(true);

cropCancelBtn.onclick = () => {
  resetImageInput();
  closeCropper();
};

cropCancelTopBtn.onclick = cropCancelBtn.onclick;

/* ================= 登入狀態更新 ================= */

window.addEventListener("auth:changed", () => {
  applyRoleVisibility();
  renderItems();
  renderLogs();
});

/* ================= 初始化 ================= */

renderItems();
renderLogs();
applyRoleVisibility();
