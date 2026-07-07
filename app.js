const STORAGE_KEY = "wishfit.v6";
const CATEGORIES = ["Outer", "Top", "Bottom", "Acc"];

const state = loadState();

const els = {
  addItemBtn: document.getElementById("addItemBtn"),
  categoryTabs: document.getElementById("categoryTabs"),
  itemGrid: document.getElementById("itemGrid"),
  itemDialog: document.getElementById("itemDialog"),
  itemForm: document.getElementById("itemForm"),
  itemLinkInput: document.getElementById("itemLinkInput"),
  itemPhotoInput: document.getElementById("itemPhotoInput"),
  itemBrandInput: document.getElementById("itemBrandInput"),
  itemNameInput: document.getElementById("itemNameInput"),
  itemPriceInput: document.getElementById("itemPriceInput"),
  itemCategoryBtn: document.getElementById("itemCategoryBtn"),
  itemCategoryList: document.getElementById("itemCategoryList"),
  closeItemBtn: document.getElementById("closeItemBtn"),
  detailDialog: document.getElementById("detailDialog"),
  detailForm: document.getElementById("detailForm"),
  detailLoginTypeBtn: document.getElementById("detailLoginTypeBtn"),
  detailLoginTypeList: document.getElementById("detailLoginTypeList"),
  detailAuthFields: document.getElementById("detailAuthFields"),
  detailSiteIdInput: document.getElementById("detailSiteIdInput"),
  detailPasswordInput: document.getElementById("detailPasswordInput"),
  closeDetailBtn: document.getElementById("closeDetailBtn"),
  cropOverlay: document.getElementById("cropOverlay"),
  cropImage: document.getElementById("cropImage"),
  cropScaleInput: document.getElementById("cropScaleInput"),
  cropXInput: document.getElementById("cropXInput"),
  cropYInput: document.getElementById("cropYInput"),
  closeCropBtn: document.getElementById("closeCropBtn"),
  cropForm: document.getElementById("cropForm"),
  itemTemplate: document.getElementById("itemTemplate"),
};

let activeCategory = "Outer";
let draftCategory = "Outer";
let categoryListOpen = false;
let detailLoginTypeListOpen = false;
let detailItemId = null;
let editItemId = null;
let draftPhotoDataUrl = "";
let draftPhotoFile = null;
let draftPhotoSource = "";
let cropSettings = { scale: 1, x: 0, y: 0 };

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return { items: parsed.items.map(normalizeItem) };
  } catch {
    return { items: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeItem(item) {
  return {
    id: item?.id || uid(),
    category: CATEGORIES.includes(item?.category) ? item.category : "Outer",
    link: String(item?.link || ""),
    photo: String(item?.photo || ""),
    brand: String(item?.brand || ""),
    name: String(item?.name || ""),
    price: String(item?.price || ""),
    siteId: String(item?.siteId || ""),
    password: String(item?.password || ""),
    loginMethod: item?.loginMethod === "other" ? "other" : "kakao",
    updatedAt: Number(item?.updatedAt || Date.now()),
  };
}

function formatPrice(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function openDialog(dialog) {
  dialog.showModal();
  document.body.classList.add("modal-open");
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
  document.body.classList.remove("modal-open");
  if (dialog === els.detailDialog) {
    detailItemId = null;
    setDetailLoginTypeListOpen(false);
  }
  if (dialog === els.itemDialog) {
    setCategoryListOpen(false);
    editItemId = null;
    draftPhotoDataUrl = "";
    draftPhotoFile = null;
    draftPhotoSource = "";
    if (els.cropOverlay.open) els.cropOverlay.close();
  }
}

function setActiveCategory(category, syncHash = true) {
  const nextCategory = CATEGORIES.includes(category) ? category : "Outer";
  if (activeCategory === nextCategory) {
    if (syncHash && location.hash.slice(1) !== nextCategory) {
      history.replaceState(null, "", `#${nextCategory}`);
    }
    return;
  }
  activeCategory = nextCategory;
  renderTabs();
  renderItems();
  if (syncHash) {
    history.replaceState(null, "", `#${nextCategory}`);
  }
}

function setDraftCategory(category) {
  draftCategory = CATEGORIES.includes(category) ? category : "Outer";
  updateCategoryButton();
}

function setCategoryListOpen(open) {
  categoryListOpen = Boolean(open);
  els.itemCategoryList.hidden = !categoryListOpen;
  els.itemCategoryBtn.setAttribute("aria-expanded", String(categoryListOpen));
}

function setDetailLoginTypeListOpen(open) {
  detailLoginTypeListOpen = Boolean(open);
  els.detailLoginTypeList.hidden = !detailLoginTypeListOpen;
  els.detailLoginTypeBtn.setAttribute("aria-expanded", String(detailLoginTypeListOpen));
}

function currentItem() {
  return state.items.find((item) => item.id === detailItemId) || null;
}

function editingItem() {
  return state.items.find((item) => item.id === editItemId) || null;
}

function closeAllItemMenus() {
  for (const menu of document.querySelectorAll(".item-action-menu")) {
    menu.hidden = true;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

async function cropDataUrl(source, settings) {
  const img = await loadImage(source);
  const outputW = 1200;
  const outputH = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = outputW;
  canvas.height = outputH;

  const baseScale = Math.max(outputW / img.naturalWidth, outputH / img.naturalHeight);
  const scale = baseScale * settings.scale;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const offsetX = (settings.x / 100) * Math.max(drawW - outputW, 0) * 0.5;
  const offsetY = (settings.y / 100) * Math.max(drawH - outputH, 0) * 0.5;
  const drawX = outputW / 2 - drawW / 2 + offsetX;
  const drawY = outputH / 2 - drawH / 2 + offsetY;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputW, outputH);
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function renderTabs() {
  for (const button of els.categoryTabs.querySelectorAll(".tab-btn")) {
    button.classList.toggle("active", button.dataset.category === activeCategory);
  }
}

function updateCategoryButton() {
  els.itemCategoryBtn.textContent = draftCategory;
  for (const button of els.itemCategoryList.querySelectorAll(".category-option")) {
    button.classList.toggle("active", button.dataset.category === draftCategory);
  }
}

function updateDetailLoginTypeButton() {
  const value = els.detailLoginTypeBtn.dataset.value || "kakao";
  els.detailLoginTypeBtn.textContent = value === "other" ? "기타" : "카카오톡 로그인";
  for (const button of els.detailLoginTypeList.querySelectorAll(".category-option")) {
    button.classList.toggle("active", button.dataset.loginType === value);
  }
  els.detailAuthFields.hidden = value !== "other";
}

function updatePhotoPreviewBackground() {
  if (!draftPhotoSource) return;
  const bg = `url("${draftPhotoSource.replaceAll('"', "%22")}")`;
  els.cropImage.style.backgroundImage = bg;
  els.cropImage.style.backgroundRepeat = "no-repeat";
  els.cropImage.style.backgroundPosition = `${50 + cropSettings.x * 0.5}% ${50 + cropSettings.y * 0.5}%`;
  els.cropImage.style.backgroundSize = `${cropSettings.scale * 100}%`;
}

function openAddDialog() {
  editItemId = null;
  draftCategory = activeCategory;
  els.itemForm.reset();
  draftPhotoDataUrl = "";
  draftPhotoFile = null;
  draftPhotoSource = "";
  setDraftCategory(draftCategory);
  setCategoryListOpen(false);
  els.itemPhotoInput.required = true;
  openDialog(els.itemDialog);
  els.itemLinkInput.focus();
}

function openEditDialog(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  editItemId = itemId;
  draftCategory = item.category;
  setDraftCategory(draftCategory);
  setCategoryListOpen(false);
  els.itemForm.reset();
  els.itemLinkInput.value = item.link;
  els.itemBrandInput.value = item.brand;
  els.itemNameInput.value = item.name;
  els.itemPriceInput.value = item.price;
  draftPhotoDataUrl = item.photo;
  draftPhotoSource = item.photo;
  els.itemPhotoInput.required = false;
  openDialog(els.itemDialog);
  els.itemLinkInput.focus();
}

function deleteItem(itemId) {
  state.items = state.items.filter((item) => item.id !== itemId);
  if (detailItemId === itemId) {
    detailItemId = null;
    closeDialog(els.detailDialog);
  }
  if (editItemId === itemId) {
    editItemId = null;
  }
  saveState();
  renderItems();
}

function openDetailDialog(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  detailItemId = itemId;
  els.detailForm.reset();
  els.detailLoginTypeBtn.dataset.value = item.loginMethod || "kakao";
  els.detailSiteIdInput.value = item.siteId;
  els.detailPasswordInput.value = item.password;
  updateDetailLoginTypeButton();
  openDialog(els.detailDialog);
  els.detailLoginTypeBtn.focus();
}

function renderItems() {
  els.itemGrid.innerHTML = "";

  const items = state.items
    .filter((item) => item.category === activeCategory)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  for (const item of items) {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;

    const photo = node.querySelector(".item-photo");
    const brand = node.querySelector(".item-brand");
    const name = node.querySelector(".item-name");
    const price = node.querySelector(".item-price");
    const cartBtn = node.querySelector(".cart-btn");
    const menuBtn = node.querySelector(".item-menu-btn");
    const actionMenu = node.querySelector(".item-action-menu");
    const actionEdit = node.querySelector(".item-action-edit");
    const actionDelete = node.querySelector(".item-action-delete");

    photo.src = item.photo;
    photo.alt = item.name || item.brand || "";
    photo.addEventListener("error", () => {
      photo.removeAttribute("src");
      photo.hidden = true;
    });
    photo.addEventListener("load", () => {
      photo.hidden = false;
    });

    brand.textContent = item.brand;
    name.innerHTML = escapeHtml(item.name);
    price.textContent = item.price;

    photo.addEventListener("click", (event) => {
      event.stopPropagation();
      openDetailDialog(item.id);
    });

    node.addEventListener("click", () => openDetailDialog(item.id));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetailDialog(item.id);
      }
    });

    cartBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (item.link) window.location.href = item.link;
    });

    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = !actionMenu.hidden;
      closeAllItemMenus();
      actionMenu.hidden = isOpen;
    });

    actionEdit.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAllItemMenus();
      openEditDialog(item.id);
    });

    actionDelete.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAllItemMenus();
      if (window.confirm("이 카드를 삭제할까요?")) {
        deleteItem(item.id);
      }
    });

    els.itemGrid.appendChild(node);
  }
}

async function preparePhotoFromFile(file) {
  draftPhotoFile = file;
  draftPhotoSource = await readFileAsDataUrl(file);
  cropSettings = { scale: 1, x: 0, y: 0 };
  els.cropScaleInput.value = "1";
  els.cropXInput.value = "0";
  els.cropYInput.value = "0";
  updatePhotoPreviewBackground();
  els.cropOverlay.showModal();
}

async function addOrUpdateItem() {
  const price = formatPrice(els.itemPriceInput.value);
  if (!price) return;
  if (!draftPhotoDataUrl) return;

  const existing = editingItem();

  const item = normalizeItem({
    id: editItemId || uid(),
    category: draftCategory,
    link: els.itemLinkInput.value.trim(),
    photo: draftPhotoDataUrl,
    brand: els.itemBrandInput.value.trim(),
    name: els.itemNameInput.value.trim(),
    price,
    siteId: existing?.siteId || "",
    password: existing?.password || "",
    loginMethod: existing?.loginMethod || "kakao",
    updatedAt: Date.now(),
  });

  if (editItemId) {
    state.items = state.items.map((entry) => (entry.id === editItemId ? item : entry));
  } else {
    state.items.unshift(item);
  }

  saveState();
  renderItems();
}

function updateDetailFromDialog() {
  const item = currentItem();
  if (!item) return;

  const next = normalizeItem({
    ...item,
    loginMethod: els.detailLoginTypeBtn.dataset.value === "other" ? "other" : "kakao",
    siteId: els.detailSiteIdInput.value.trim(),
    password: els.detailPasswordInput.value.trim(),
    updatedAt: Date.now(),
  });

  state.items = state.items.map((entry) => (entry.id === item.id ? next : entry));
  saveState();
  renderItems();
}

els.addItemBtn.addEventListener("click", openAddDialog);
els.closeItemBtn.addEventListener("click", () => closeDialog(els.itemDialog));
els.closeDetailBtn.addEventListener("click", () => closeDialog(els.detailDialog));
els.closeCropBtn.addEventListener("click", () => {
  if (els.cropOverlay.open) els.cropOverlay.close();
  if (!editItemId) {
    draftPhotoDataUrl = "";
  }
});

els.itemDialog.addEventListener("click", (event) => {
  if (event.target === els.itemDialog) closeDialog(els.itemDialog);
});

els.detailDialog.addEventListener("click", (event) => {
  if (event.target === els.detailDialog) closeDialog(els.detailDialog);
});

els.itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!draftPhotoDataUrl) return;
  await addOrUpdateItem();
  closeDialog(els.itemDialog);
});

els.detailForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateDetailFromDialog();
  closeDialog(els.detailDialog);
});

els.itemPriceInput.addEventListener("input", (event) => {
  event.target.value = formatPrice(event.target.value);
});

els.itemPhotoInput.addEventListener("change", async () => {
  const file = els.itemPhotoInput.files?.[0];
  if (!file) return;
  await preparePhotoFromFile(file);
});

els.cropForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!draftPhotoSource) return;
  draftPhotoDataUrl = await cropDataUrl(draftPhotoSource, cropSettings);
  if (els.cropOverlay.open) els.cropOverlay.close();
});

els.cropScaleInput.addEventListener("input", (event) => {
  cropSettings.scale = Number(event.target.value);
  updatePhotoPreviewBackground();
});

els.cropXInput.addEventListener("input", (event) => {
  cropSettings.x = Number(event.target.value);
  updatePhotoPreviewBackground();
});

els.cropYInput.addEventListener("input", (event) => {
  cropSettings.y = Number(event.target.value);
  updatePhotoPreviewBackground();
});

els.itemCategoryBtn.addEventListener("click", () => {
  setCategoryListOpen(!categoryListOpen);
});

els.itemCategoryList.addEventListener("click", (event) => {
  const button = event.target.closest(".category-option");
  if (!button) return;
  setActiveCategory(button.dataset.category);
  setDraftCategory(button.dataset.category);
  setCategoryListOpen(false);
});

els.itemGrid.addEventListener("click", (event) => {
  if (!event.target.closest(".item-action-menu") && !event.target.closest(".item-menu-btn")) {
    closeAllItemMenus();
  }
});

els.detailLoginTypeBtn.addEventListener("click", () => {
  setDetailLoginTypeListOpen(!detailLoginTypeListOpen);
});

els.detailLoginTypeList.addEventListener("click", (event) => {
  const button = event.target.closest(".category-option");
  if (!button) return;
  els.detailLoginTypeBtn.dataset.value = button.dataset.loginType;
  updateDetailLoginTypeButton();
  setDetailLoginTypeListOpen(false);
  if (button.dataset.loginType === "kakao") {
    els.detailSiteIdInput.value = "";
    els.detailPasswordInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (els.itemDialog.open) {
    const insideItemPicker =
      event.target === els.itemCategoryBtn || els.itemCategoryList.contains(event.target);
    if (!insideItemPicker && !els.itemDialog.contains(event.target)) {
      setCategoryListOpen(false);
    }
  }

  if (els.detailDialog.open) {
    const insideLoginPicker =
      event.target === els.detailLoginTypeBtn || els.detailLoginTypeList.contains(event.target);
    if (!insideLoginPicker && !els.detailDialog.contains(event.target)) {
      setDetailLoginTypeListOpen(false);
    }
  }

  if (!event.target.closest(".item-card")) {
    closeAllItemMenus();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDialog(els.itemDialog);
    closeDialog(els.detailDialog);
    if (els.cropOverlay.open) els.cropOverlay.close();
  }
});

window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  const initialCategory = location.hash.replace("#", "");
  if (CATEGORIES.includes(initialCategory)) {
    setActiveCategory(initialCategory, false);
  }
});

window.addEventListener("hashchange", () => {
  const nextCategory = location.hash.replace("#", "");
  if (CATEGORIES.includes(nextCategory)) {
    setActiveCategory(nextCategory, false);
  }
});

renderTabs();
updateCategoryButton();
updateDetailLoginTypeButton();
renderItems();
