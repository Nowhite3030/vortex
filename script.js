const STORAGE_KEY = "warehouse_items_v1";
const LOG_KEY = "warehouse_logs_v1";

const itemForm = document.getElementById("itemForm");
const itemName = document.getElementById("itemName");
const itemCategory = document.getElementById("itemCategory");
const itemQuantity = document.getElementById("itemQuantity");
const itemImage = document.getElementById("itemImage");
const previewBox = document.getElementById("previewBox");
const itemGrid = document.getElementById("itemGrid");
const searchInput = document.getElementById("searchInput");
const logList = document.getElementById("logList");
const clearLogBtn = document.getElementById("clearLogBtn");
const exportBtn = document.getElementById("exportBtn");
const template = document.getElementById("itemCardTemplate");

let imageBase64 = "";
let items = loadData(STORAGE_KEY);
let logs = loadData(LOG_KEY);

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

    if (Number(item.quantity) <= 5) {
      stock.classList.add("low-stock");
    }

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
  if (!amount || amount <= 0 && Math.sign(amount) !== -1) return;

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

itemImage.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) {
    imageBase64 = "";
    previewBox.innerHTML = "<span>圖片預覽</span>";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    imageBase64 = reader.result;
    previewBox.innerHTML = `<img src="${imageBase64}" alt="圖片預覽">`;
  };
  reader.readAsDataURL(file);
});

itemForm.addEventListener("submit", event => {
  event.preventDefault();

  const newItem = {
    id: createId(),
    name: itemName.value.trim(),
    category: itemCategory.value.trim(),
    quantity: Number(itemQuantity.value),
    image: imageBase64
  };

  if (!newItem.name) return;

  items.unshift(newItem);
  saveData();
  addLog(`新增物品「${newItem.name}」，初始數量 ${newItem.quantity}`);

  itemForm.reset();
  imageBase64 = "";
  previewBox.innerHTML = "<span>圖片預覽</span>";
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
