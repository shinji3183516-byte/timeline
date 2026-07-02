"use strict";

const state = { files: [], results: [] };
const $ = (id) => document.getElementById(id);

const els = {
  fileInput: $("fileInput"), dropZone: $("dropZone"), fileCount: $("fileCount"), clearButton: $("clearButton"),
  outputFormat: $("outputFormat"), targetWidth: $("targetWidth"), targetHeight: $("targetHeight"), fitMode: $("fitMode"),
  alignX: $("alignX"), alignY: $("alignY"), removeBackground: $("removeBackground"), threshold: $("threshold"), feather: $("feather"),
  thresholdValue: $("thresholdValue"), featherValue: $("featherValue"), shadowMode: $("shadowMode"), namePattern: $("namePattern"),
  startIndex: $("startIndex"), indexDigits: $("indexDigits"), processButton: $("processButton"), downloadZipButton: $("downloadZipButton"),
  progressWrap: $("progressWrap"), progressBar: $("progressBar"), progressText: $("progressText"), results: $("results"),
  resultSummary: $("resultSummary"), resultTemplate: $("resultTemplate"),
  uploadStatus: $("uploadStatus"), uploadStatusTitle: $("uploadStatusTitle"), uploadStatusText: $("uploadStatusText"),
  selectedFiles: $("selectedFiles")
};

els.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
["dragenter", "dragover"].forEach((type) => els.dropZone.addEventListener(type, (event) => { event.preventDefault(); els.dropZone.classList.add("dragover"); }));
["dragleave", "drop"].forEach((type) => els.dropZone.addEventListener(type, (event) => { event.preventDefault(); els.dropZone.classList.remove("dragover"); }));
els.dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
els.clearButton.addEventListener("click", clearAll);
els.threshold.addEventListener("input", () => els.thresholdValue.value = els.threshold.value);
els.feather.addEventListener("input", () => els.featherValue.value = els.feather.value);
els.processButton.addEventListener("click", processAll);
els.downloadZipButton.addEventListener("click", downloadZip);

function addFiles(fileList) {
  const images = [...fileList].filter((file) => file.type.startsWith("image/"));
  const known = new Set(state.files.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
  for (const file of images) {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!known.has(key)) state.files.push(file);
  }
  els.fileInput.value = "";
  updateFileCount();
  renderSelectedFiles();
}

function clearAll() {
  state.files = [];
  state.results.forEach((item) => URL.revokeObjectURL(item.url));
  state.results = [];
  updateFileCount();
  renderSelectedFiles();
  renderResults();
}

function updateFileCount() {
  const count = state.files.length;
  els.fileCount.textContent = `${count}枚選択`;
  els.processButton.disabled = count === 0;
  els.dropZone.classList.toggle("has-files", count > 0);
  els.uploadStatus.classList.toggle("has-files", count > 0);
  if (count > 0) {
    els.uploadStatusTitle.textContent = `${count}枚の画像を受け付けました`;
    els.uploadStatusText.textContent = "下の一覧で画像とファイル名を確認できます";
    els.dropZone.querySelector("strong").textContent = `${count}枚追加済み`;
    els.dropZone.querySelector("small").textContent = "さらに追加する場合は、ここへドロップまたはクリック";
  } else {
    els.uploadStatusTitle.textContent = "画像はまだ追加されていません";
    els.uploadStatusText.textContent = "ここへ画像をドロップしてください";
    els.dropZone.querySelector("strong").textContent = "画像をここへドロップ";
    els.dropZone.querySelector("small").textContent = "またはクリックして複数選択";
  }
}

function renderSelectedFiles() {
  els.selectedFiles.innerHTML = "";
  els.selectedFiles.hidden = state.files.length === 0;
  state.files.forEach((file, index) => {
    const card = document.createElement("article");
    card.className = "selected-file";
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.src = url;
    img.alt = file.name;
    img.onload = () => URL.revokeObjectURL(url);
    const info = document.createElement("div");
    info.className = "selected-file-info";
    const name = document.createElement("span");
    name.className = "selected-file-name";
    name.textContent = file.name;
    name.title = file.name;
    const size = document.createElement("span");
    size.className = "selected-file-size";
    size.textContent = formatBytes(file.size);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "selected-file-remove";
    remove.textContent = "×";
    remove.title = `${file.name}を削除`;
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.files.splice(index, 1);
      updateFileCount();
      renderSelectedFiles();
    });
    info.append(name, size);
    card.append(img, info, remove);
    els.selectedFiles.appendChild(card);
  });
}

async function processAll() {
  if (!state.files.length) return;
  state.results.forEach((item) => URL.revokeObjectURL(item.url));
  state.results = [];
  setProgress(0, "処理を開始します...");
  els.progressWrap.hidden = false;
  els.processButton.disabled = true;
  els.downloadZipButton.disabled = true;

  for (let i = 0; i < state.files.length; i++) {
    const file = state.files[i];
    setProgress((i / state.files.length) * 100, `${i + 1}/${state.files.length} ${file.name} を処理中`);
    try {
      const result = await processFile(file, i);
      state.results.push(result);
    } catch (error) {
      console.error(error);
      state.results.push({ error: true, originalName: file.name, message: error.message || "処理に失敗しました" });
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  setProgress(100, `完了：${state.results.filter((x) => !x.error).length}枚`);
  els.processButton.disabled = false;
  els.downloadZipButton.disabled = !state.results.some((x) => !x.error);
  renderResults();
}

async function processFile(file, fileIndex) {
  const image = await loadImage(file);
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  sourceCtx.drawImage(image, 0, 0);

  if (els.removeBackground.checked) {
    removeBackground(sourceCtx, source.width, source.height);
  }

  const width = clampInt(els.targetWidth.value, 1, 8000, 1200);
  const height = clampInt(els.targetHeight.value, 1, 8000, 800);
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const ctx = output.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const format = els.outputFormat.value;
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const rect = calculateDrawRect(source.width, source.height, width, height, els.fitMode.value, els.alignX.value, els.alignY.value);
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);

  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  const extension = format === "jpeg" ? "jpg" : format;
  const blob = await canvasToBlob(output, mime, format === "png" ? undefined : 0.92);
  const originalBase = file.name.replace(/\.[^.]+$/, "");
  const index = clampInt(els.startIndex.value, 0, 999999, 1) + fileIndex;
  const digits = clampInt(els.indexDigits.value, 1, 6, 2);
  const name = buildName(els.namePattern.value, originalBase, index, digits, width, height, extension);
  return { blob, name, width, height, originalName: file.name, url: URL.createObjectURL(blob) };
}

function removeBackground(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const samples = sampleCorners(data, width, height);
  const bg = medianColor(samples);
  const threshold = Number(els.threshold.value);
  const feather = Number(els.feather.value);
  const strictFactor = els.shadowMode.value === "strict" ? 1.2 : 1;
  const hard = threshold * strictFactor;
  const soft = hard + feather;

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - bg.r;
    const dg = data[i + 1] - bg.g;
    const db = data[i + 2] - bg.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const bgBrightness = (bg.r + bg.g + bg.b) / 3;
    const brightnessPenalty = Math.abs(brightness - bgBrightness) * 0.28;
    const adjusted = distance + brightnessPenalty;

    if (adjusted <= hard) {
      data[i + 3] = 0;
    } else if (feather > 0 && adjusted < soft) {
      const ratio = (adjusted - hard) / feather;
      data[i + 3] = Math.round(data[i + 3] * ratio);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function sampleCorners(data, width, height) {
  const block = Math.max(3, Math.floor(Math.min(width, height) * 0.035));
  const points = [];
  const origins = [[0,0],[width-block,0],[0,height-block],[width-block,height-block]];
  for (const [ox, oy] of origins) {
    for (let y = oy; y < Math.min(height, oy + block); y += Math.max(1, Math.floor(block / 6))) {
      for (let x = ox; x < Math.min(width, ox + block); x += Math.max(1, Math.floor(block / 6))) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 0) points.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
    }
  }
  return points;
}

function medianColor(samples) {
  if (!samples.length) return { r: 255, g: 255, b: 255 };
  const median = (key) => samples.map((x) => x[key]).sort((a,b) => a-b)[Math.floor(samples.length / 2)];
  return { r: median("r"), g: median("g"), b: median("b") };
}

function calculateDrawRect(sw, sh, tw, th, mode, alignX, alignY) {
  let dw = tw, dh = th;
  if (mode !== "stretch") {
    const scale = mode === "cover" ? Math.max(tw / sw, th / sh) : Math.min(tw / sw, th / sh);
    dw = sw * scale;
    dh = sh * scale;
  }
  const x = alignX === "left" ? 0 : alignX === "right" ? tw - dw : (tw - dw) / 2;
  const y = alignY === "top" ? 0 : alignY === "bottom" ? th - dh : (th - dh) / 2;
  return { x, y, width: dw, height: dh };
}

function buildName(pattern, original, index, digits, width, height, extension) {
  const safeOriginal = sanitizeName(original);
  const indexText = String(index).padStart(digits, "0");
  let name = (pattern || "{name}_{index}")
    .replaceAll("{name}", safeOriginal)
    .replaceAll("{index}", indexText)
    .replaceAll("{width}", String(width))
    .replaceAll("{height}", String(height));
  name = sanitizeName(name).replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return `${name || `image_${indexText}`}.${extension}`;
}

function sanitizeName(name) {
  return name.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
}

function renderResults() {
  els.results.innerHTML = "";
  if (!state.results.length) {
    els.results.innerHTML = '<div class="empty-state">画像を追加し、「一括処理する」を押してください。</div>';
    els.resultSummary.textContent = "まだ処理されていません";
    return;
  }
  let success = 0;
  for (const item of state.results) {
    if (item.error) {
      const error = document.createElement("div");
      error.className = "empty-state";
      error.textContent = `${item.originalName}: ${item.message}`;
      els.results.appendChild(error);
      continue;
    }
    success++;
    const node = els.resultTemplate.content.cloneNode(true);
    node.querySelector("img").src = item.url;
    node.querySelector(".result-name").textContent = item.name;
    node.querySelector(".result-size").textContent = `${item.width} × ${item.height}px / ${formatBytes(item.blob.size)}`;
    node.querySelector(".download-one").addEventListener("click", () => triggerDownload(item.blob, item.name));
    els.results.appendChild(node);
  }
  els.resultSummary.textContent = `${success}枚を処理済み`;
}

async function downloadZip() {
  const valid = state.results.filter((item) => !item.error);
  if (!valid.length) return;
  els.downloadZipButton.disabled = true;
  els.downloadZipButton.textContent = "ZIP作成中...";
  try {
    const files = [];
    for (const item of valid) files.push({ name: item.name, bytes: new Uint8Array(await item.blob.arrayBuffer()) });
    const zipBlob = createStoredZip(files);
    triggerDownload(zipBlob, `processed_images_${new Date().toISOString().slice(0,10)}.zip`);
  } finally {
    els.downloadZipButton.disabled = false;
    els.downloadZipButton.textContent = "ZIPで保存";
  }
}

function createStoredZip(files) {
  const localParts = [], centralParts = [];
  let offset = 0;
  const encoder = new TextEncoder();
  const now = dosDateTime(new Date());
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length);
    const ldv = new DataView(local.buffer);
    ldv.setUint32(0, 0x04034b50, true); ldv.setUint16(4, 20, true); ldv.setUint16(6, 0x0800, true); ldv.setUint16(8, 0, true);
    ldv.setUint16(10, now.time, true); ldv.setUint16(12, now.date, true); ldv.setUint32(14, crc, true);
    ldv.setUint32(18, file.bytes.length, true); ldv.setUint32(22, file.bytes.length, true); ldv.setUint16(26, name.length, true); ldv.setUint16(28, 0, true);
    local.set(name, 30); localParts.push(local, file.bytes);

    const central = new Uint8Array(46 + name.length);
    const cdv = new DataView(central.buffer);
    cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true); cdv.setUint16(8, 0x0800, true);
    cdv.setUint16(10, 0, true); cdv.setUint16(12, now.time, true); cdv.setUint16(14, now.date, true); cdv.setUint32(16, crc, true);
    cdv.setUint32(20, file.bytes.length, true); cdv.setUint32(24, file.bytes.length, true); cdv.setUint16(28, name.length, true);
    cdv.setUint16(30, 0, true); cdv.setUint16(32, 0, true); cdv.setUint16(34, 0, true); cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true); cdv.setUint32(42, offset, true); central.set(name, 46); centralParts.push(central);
    offset += local.length + file.bytes.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22); const edv = new DataView(end.buffer);
  edv.setUint32(0, 0x06054b50, true); edv.setUint16(4, 0, true); edv.setUint16(6, 0, true);
  edv.setUint16(8, files.length, true); edv.setUint16(10, files.length, true); edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true); edv.setUint16(20, 0, true);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像を読み込めません")); };
    img.src = url;
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("画像を書き出せません")), mime, quality));
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function setProgress(percent, text) { els.progressBar.style.width = `${percent}%`; els.progressText.textContent = text; }
function clampInt(value, min, max, fallback) { const n = Number.parseInt(value, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
function formatBytes(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 ** 2).toFixed(1)} MB`; }

updateFileCount();
renderSelectedFiles();
