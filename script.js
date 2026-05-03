const STORAGE_KEY = "warehouse_items_v1";
const LOG_KEY = "warehouse_logs_v1";

const itemForm = document.getElementById("itemForm");
const itemName = document.getElementById("itemName");
const itemCategory = document.getElementById("itemCategory");
const itemQuantity = document.getElementById("itemQuantity");
const itemImage = document.getElementById("itemImage");
const previewBox = document.getElementById("previewBox");
const imageInfo = document.getElementById("imageInfo");
const itemGrid = document.getElementById("itemGrid");
const searchInput = document.getElementById("searchInput");
const logList = document.getElementById("logList");
const clearLogBtn = document.getElementById("clearLogBtn");
const exportBtn = document.getElementById("exportBtn");
const template = document.getElementById("itemCardTemplate");

const cropModal = document.getElementById("cropModal");
const cropCanvas = document.getElementById("cropCanvas");
const cropInfo = document.getElementById("cropInfo");
const cropConfirmBtn = document.getElementById("cropConfirmBtn");
const cropCancelBtn = document.getElementById("cropCancelBtn");
const cropCancelTopBtn = document.getElementById("cropCancelTopBtn");
const cropFullBtn = document.getElementById("cropFullBtn");
const cropCtx = cropCanvas.getContext("2d");

let imageBase64 = "";
let imageMeta = null;
let items = loadData(STORAGE_KEY);
let logs = loadData(LOG_KEY);

let cropState = {
  file: null,
  sourceImage: null,
  originalDataUrl: "",
  displayWidth: 0,
  displayHeight: 0,
  selection: null,
  isDragging: false,
  startX: 0,
  startY: 0
};

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

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatImageMeta(meta) {
  if (!meta) return "圖片資訊：無圖片";
  const croppedText = meta.cropped ? `，原圖 ${meta.originalWidth} × ${meta.originalHeight}px` : "";
  return `圖片資訊：${meta.width} × ${meta.height}px，${formatFileSize(meta.fileSize)}${croppedText}`;
}

function resetImageInput() {
  imageBase64 = "";
  imageMeta = null;
  itemImage.value = "";
  previewBox.innerHTML = "<span>圖片預覽</span>";
  imageInfo.textContent = "尚未選擇圖片";
}

function addLog(text) {
  const now = new Date().toLocaleString("zh-TW", { hour12: false });
  logs.unshift(`${now}｜${text}`);
  logs = logs.slice(0, 100);
  saveData();
  renderLogs();
}

function renderItems() {
  const keyword = searchInput.value.trim().toLowerCase();
  const filteredItems = items.filter(item => {
    return item.name.toLowerCase().includes(keyword) ||
      (item.category || "").toLowerCase().includes(keyword);
  });

  itemGrid.innerHTML = "";

  if (filteredItems.length === 0) {
    itemGrid.innerHTML = `<div class="empty-text">目前沒有符合條件的物品</div>`;
    return;
  }

  filteredItems.forEach(item => {
    const card = template.content.cloneNode(true);
    const imageWrap = card.querySelector(".image-wrap");
    const title = card.querySelector("h3");
    const category = card.querySelector(".category");
    const stock = card.querySelector(".stock");
    const imageMetaText = card.querySelector(".image-meta");
    const adjustInput = card.querySelector(".adjust-input");
    const takeBtn = card.querySelector(".take-btn");
    const addBtn = card.querySelector(".add-btn");
    const deleteBtn = card.querySelector(".delete-btn");

    if (item.image) {
      imageWrap.innerHTML = `<img src="${item.image}" alt="${escapeHtml(item.name)}">`;
    } else {
      imageWrap.textContent = "無圖片";
    }

    title.textContent = item.name;
    category.textContent = item.category ? `分類：${item.category}` : "分類：未分類";
    stock.textContent = `目前庫存：${item.quantity}`;
    imageMetaText.textContent = formatImageMeta(item.imageMeta);

    if (Number(item.quantity) <= 5) stock.classList.add("low-stock");

    takeBtn.addEventListener("click", () => adjustQuantity(item.id, -Number(adjustInput.value)));
    addBtn.addEventListener("click", () => adjustQuantity(item.id, Number(adjustInput.value)));
    deleteBtn.addEventListener("click", () => deleteItem(item.id));

    itemGrid.appendChild(card);
  });
}

function renderLogs() {
  logList.innerHTML = "";

  if (logs.length === 0) {
    logList.innerHTML = `<li>目前沒有操作紀錄</li>`;
    return;
  }

  logs.forEach(log => {
    const li = document.createElement("li");
    li.textContent = log;
    logList.appendChild(li);
  });
}

function adjustQuantity(id, amount) {
  if (!amount || Number.isNaN(amount)) return;

  const item = items.find(target => target.id === id);
  if (!item) return;

  if (amount < 0 && item.quantity + amount < 0) {
    alert("庫存不足，無法提取超過目前庫存的數量。");
    return;
  }

  item.quantity += amount;
  saveData();
  renderItems();

  const action = amount > 0 ? "補充" : "提取";
  addLog(`${action}「${item.name}」${Math.abs(amount)} 個，目前庫存 ${item.quantity}`);
}

function deleteItem(id) {
  const item = items.find(target => target.id === id);
  if (!item) return;

  const confirmed = confirm(`確定要刪除「${item.name}」嗎？`);
  if (!confirmed) return;

  items = items.filter(target => target.id !== id);
  saveData();
  renderItems();
  addLog(`刪除物品「${item.name}」`);
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

function openCropModal(file, dataUrl) {
  const img = new Image();
  img.onload = () => {
    const maxWidth = Math.min(820, window.innerWidth - 80);
    const maxHeight = Math.min(520, window.innerHeight - 260);
    const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);

    cropState = {
      file,
      sourceImage: img,
      originalDataUrl: dataUrl,
      displayWidth: Math.round(img.naturalWidth * scale),
      displayHeight: Math.round(img.naturalHeight * scale),
      selection: null,
      isDragging: false,
      startX: 0,
      startY: 0
    };

    cropCanvas.width = cropState.displayWidth;
    cropCanvas.height = cropState.displayHeight;
    setFullSelection();
    cropModal.classList.add("is-open");
    cropModal.setAttribute("aria-hidden", "false");
    drawCropCanvas();
  };
  img.onerror = () => {
    resetImageInput();
    alert("無法讀取圖片，請確認檔案是否為有效圖片。");
  };
  img.src = dataUrl;
}

function closeCropModal(shouldReset = false) {
  cropModal.classList.remove("is-open");
  cropModal.setAttribute("aria-hidden", "true");
  if (shouldReset) resetImageInput();
}

function setFullSelection() {
  cropState.selection = {
    x: 0,
    y: 0,
    width: cropState.displayWidth,
    height: cropState.displayHeight
  };
  updateCropInfo();
}

function drawCropCanvas() {
  const { sourceImage, displayWidth, displayHeight, selection } = cropState;
  if (!sourceImage) return;

  cropCtx.clearRect(0, 0, displayWidth, displayHeight);
  cropCtx.drawImage(sourceImage, 0, 0, displayWidth, displayHeight);

  if (!selection) return;

  cropCtx.save();
  cropCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  cropCtx.fillRect(0, 0, displayWidth, displayHeight);
  cropCtx.clearRect(selection.x, selection.y, selection.width, selection.height);
  cropCtx.drawImage(sourceImage, 0, 0, displayWidth, displayHeight);

  cropCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  cropCtx.fillRect(0, 0, displayWidth, selection.y);
  cropCtx.fillRect(0, selection.y, selection.x, selection.height);
  cropCtx.fillRect(selection.x + selection.width, selection.y, displayWidth - selection.x - selection.width, selection.height);
  cropCtx.fillRect(0, selection.y + selection.height, displayWidth, displayHeight - selection.y - selection.height);

  cropCtx.strokeStyle = "#ffffff";
  cropCtx.lineWidth = 2;
  cropCtx.setLineDash([8, 5]);
  cropCtx.strokeRect(selection.x + 1, selection.y + 1, selection.width - 2, selection.height - 2);
  cropCtx.restore();
}

function getCanvasPoint(event) {
  const rect = cropCanvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: Math.max(0, Math.min(cropCanvas.width, (clientX - rect.left) * (cropCanvas.width / rect.width))),
    y: Math.max(0, Math.min(cropCanvas.height, (clientY - rect.top) * (cropCanvas.height / rect.height)))
  };
}

function updateSelectionFromDrag(point) {
  const x = Math.min(cropState.startX, point.x);
  const y = Math.min(cropState.startY, point.y);
  const width = Math.abs(point.x - cropState.startX);
  const height = Math.abs(point.y - cropState.startY);

  cropState.selection = {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };

  updateCropInfo();
  drawCropCanvas();
}

function updateCropInfo() {
  const { selection, sourceImage, displayWidth, displayHeight } = cropState;
  if (!selection || !sourceImage) {
    cropInfo.textContent = "尚未選擇裁切範圍";
    return;
  }

  const scaleX = sourceImage.naturalWidth / displayWidth;
  const scaleY = sourceImage.naturalHeight / displayHeight;
  const cropWidth = Math.round(selection.width * scaleX);
  const cropHeight = Math.round(selection.height * scaleY);
  cropInfo.textContent = `將保留：${cropWidth} × ${cropHeight}px｜原圖：${sourceImage.naturalWidth} × ${sourceImage.naturalHeight}px`;
}

function confirmCrop() {
  const { file, sourceImage, selection, displayWidth, displayHeight } = cropState;
  if (!file || !sourceImage || !selection || selection.width < 2 || selection.height < 2) {
    alert("請先拖曳選取要保留的圖片範圍。");
    return;
  }

  const scaleX = sourceImage.naturalWidth / displayWidth;
  const scaleY = sourceImage.naturalHeight / displayHeight;
  const sx = Math.round(selection.x * scaleX);
  const sy = Math.round(selection.y * scaleY);
  const sw = Math.round(selection.width * scaleX);
  const sh = Math.round(selection.height * scaleY);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = sw;
  outputCanvas.height = sh;
  const outputCtx = outputCanvas.getContext("2d");
  outputCtx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, sw, sh);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  imageBase64 = outputCanvas.toDataURL(outputType, 0.92);
  imageMeta = {
    width: sw,
    height: sh,
    fileSize: Math.round(imageBase64.length * 0.75),
    fileName: file.name,
    fileType: outputType,
    cropped: true,
    originalWidth: sourceImage.naturalWidth,
    originalHeight: sourceImage.naturalHeight,
    originalFileSize: file.size
  };

  previewBox.innerHTML = `<img src="${imageBase64}" alt="裁切後圖片預覽">`;
  imageInfo.textContent = `${file.name}｜裁切後 ${sw} × ${sh}px｜約 ${formatFileSize(imageMeta.fileSize)}`;
  closeCropModal(false);
}

itemImage.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) {
    resetImageInput();
    return;
  }

  if (!file.type.startsWith("image/")) {
    resetImageInput();
    alert("請選擇圖片檔案。");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => openCropModal(file, reader.result);
  reader.onerror = () => {
    resetImageInput();
    alert("讀取圖片失敗，請重新選擇檔案。");
  };
  reader.readAsDataURL(file);
});

cropCanvas.addEventListener("mousedown", event => {
  const point = getCanvasPoint(event);
  cropState.isDragging = true;
  cropState.startX = point.x;
  cropState.startY = point.y;
  cropState.selection = { x: point.x, y: point.y, width: 1, height: 1 };
  drawCropCanvas();
});

window.addEventListener("mousemove", event => {
  if (!cropState.isDragging) return;
  updateSelectionFromDrag(getCanvasPoint(event));
});

window.addEventListener("mouseup", () => {
  if (!cropState.isDragging) return;
  cropState.isDragging = false;
  updateCropInfo();
});

cropCanvas.addEventListener("touchstart", event => {
  event.preventDefault();
  const point = getCanvasPoint(event);
  cropState.isDragging = true;
  cropState.startX = point.x;
  cropState.startY = point.y;
  cropState.selection = { x: point.x, y: point.y, width: 1, height: 1 };
  drawCropCanvas();
});

window.addEventListener("touchmove", event => {
  if (!cropState.isDragging) return;
  event.preventDefault();
  updateSelectionFromDrag(getCanvasPoint(event));
}, { passive: false });

window.addEventListener("touchend", () => {
  if (!cropState.isDragging) return;
  cropState.isDragging = false;
  updateCropInfo();
});

cropFullBtn.addEventListener("click", () => {
  setFullSelection();
  drawCropCanvas();
});

cropConfirmBtn.addEventListener("click", confirmCrop);
cropCancelBtn.addEventListener("click", () => closeCropModal(true));
cropCancelTopBtn.addEventListener("click", () => closeCropModal(true));

itemForm.addEventListener("submit", event => {
  event.preventDefault();

  const newItem = {
    id: createId(),
    name: itemName.value.trim(),
    category: itemCategory.value.trim(),
    quantity: Number(itemQuantity.value),
    image: imageBase64,
    imageMeta: imageMeta
  };

  if (!newItem.name) return;

  items.unshift(newItem);
  saveData();
  addLog(`新增物品「${newItem.name}」，初始數量 ${newItem.quantity}`);

  itemForm.reset();
  resetImageInput();
  renderItems();
});

searchInput.addEventListener("input", renderItems);

clearLogBtn.addEventListener("click", () => {
  if (!confirm("確定要清空所有操作紀錄嗎？")) return;
  logs = [];
  saveData();
  renderLogs();
});

exportBtn.addEventListener("click", () => {
  const data = {
    exportedAt: new Date().toISOString(),
    items,
    logs
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "warehouse-data.json";
  link.click();
  URL.revokeObjectURL(url);
});

renderItems();
renderLogs();
