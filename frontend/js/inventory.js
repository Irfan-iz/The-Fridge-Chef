// =============================================
// FRIDGE / INVENTORY MANAGEMENT
// =============================================

let fridgeItems = JSON.parse(sessionStorage.getItem('fridgeItems') || '[]');
let currentMode = 'camera';
let cameraStream = null;
let capturedBlob = null;
let uploadBlob = null;
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function saveFridge() {
  sessionStorage.setItem('fridgeItems', JSON.stringify(fridgeItems));
}

function renderFridge() {
  const list = document.getElementById('fridgeList');
  const count = document.getElementById('fridgeCount');
  count.textContent = fridgeItems.length;

  if (fridgeItems.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div style="opacity: 0.15; margin-bottom: 16px;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        </div>
        <p style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 4px;">Your fridge is empty.</p>
        <p style="font-size: 0.8rem; color: var(--text-muted);">Add ingredients using the scanner to get started.</p>
      </div>`;
    const totalWrap = document.getElementById('fridgeTotal');
    if (totalWrap) totalWrap.style.display = 'none';
    return;
  }

  let total = 0;
  let html = fridgeItems.map((item, i) => {
    total += item.price_rm || 0;
    return `
      <div class="ingredient-card">
        <div>
          <span style="font-weight: 600; font-size: 1.05rem; color: var(--text-primary);">
            ${item.name}
          </span>
          ${item.confidence ? `<span class="confidence-badge" style="margin-left:8px;">${item.confidence}%</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">${item.price_rm ? 'RM ' + item.price_rm.toFixed(2) : ''}</span>
          <button class="btn btn-ghost btn-sm" onclick="removeItem(${i})" style="color: var(--danger); font-size: 1.2rem; padding: 0 4px;" title="Remove"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>`;
  }).join('');

  // The Magic Trigger: Glowing Button
  if (fridgeItems.length >= 2) {
    html += `
      <button class="btn btn-primary" onclick="switchTab('planner', document.querySelectorAll('.nav-item')[1])" style="width:100%; padding: 12px; font-weight: 700; margin-top: 12px;">
        Generate Recipes with ${fridgeItems.length} Items
      </button>
    `;
  }

  list.innerHTML = html;

  // Append total row if element exists
  const totalWrap = document.getElementById('fridgeTotal');
  const totalVal = document.getElementById('fridgeTotalVal');
  if (totalWrap && totalVal) {
    totalWrap.style.display = 'block';
    totalVal.textContent = `RM ${total.toFixed(2)}`;
  }
}

function removeItem(index) {
  fridgeItems.splice(index, 1);
  saveFridge();
  renderFridge();
}

function clearFridge() {
  if (fridgeItems.length === 0) return;
  fridgeItems = [];
  saveFridge();
  renderFridge();
  showToast('Fridge cleared.', 'info');
}

function addToFridge(name, price_rm, confidence = null) {
  if (fridgeItems.find(i => i.name.toLowerCase() === name.toLowerCase())) {
    showToast(`${name} is already in your fridge.`, 'info');
    return false;
  }
  fridgeItems.push({ name, price_rm, confidence });
  saveFridge();
  renderFridge();
  showToast(`${name} added to fridge!`, 'success');
  return true;
}

let activeMainTab = 'camera';
let activeCameraSubTab = 'single';

// ---- SCAN RESULT DISPLAY ----
function showScanResult(html) {
  const el = document.getElementById('scanResult');
  if (el) el.innerHTML = html;
}

// ---- REACT-STYLE MAIN TAB NAVIGATION (Camera vs Manual) ----
function switchAddMainTab(mainTab) {
  activeMainTab = mainTab;
  
  const camBtn = document.getElementById('mainTabCamera');
  const manBtn = document.getElementById('mainTabManual');
  const camView = document.getElementById('addCameraView');
  const manView = document.getElementById('addManualView');

  if (camBtn) camBtn.classList.toggle('active', mainTab === 'camera');
  if (manBtn) manBtn.classList.toggle('active', mainTab === 'manual');
  if (camView) camView.style.display = mainTab === 'camera' ? 'flex' : 'none';
  if (manView) manView.style.display = mainTab === 'manual' ? 'flex' : 'none';

  showScanResult('');
  stopCamera();
  resetScannerPreviews();
}

// ---- CAMERA SUB-TAB NAVIGATION (Upload vs Single vs Bulk) ----
function switchCameraSubTab(subTab) {
  activeCameraSubTab = subTab;

  // Toggle Sub-Pill Buttons
  ['upload', 'single', 'bulk'].forEach(tab => {
    const btn = document.getElementById('subTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (btn) btn.classList.toggle('active', tab === subTab);
    
    const view = document.getElementById('subView' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (view) view.style.display = tab === subTab ? 'flex' : 'none';
  });

  showScanResult('');
  stopCamera();
  resetScannerPreviews();
}

function resetScannerPreviews() {
  capturedBlob = uploadBlob = geminiBlob = null;
  
  const camPre = document.getElementById('singlePreScanState');
  if (camPre) camPre.style.display = 'flex';
  const camActive = document.getElementById('singleActiveStreamState');
  if (camActive) camActive.style.display = 'none';

  const camPreview = document.getElementById('camera-preview');
  if (camPreview) { camPreview.style.display = 'none'; camPreview.src = ''; }
  const captureBtn = document.getElementById('captureBtnEl');
  if (captureBtn) captureBtn.style.display = 'inline-flex';
  const scanCamBtn = document.getElementById('scanCameraBtn');
  if (scanCamBtn) scanCamBtn.style.display = 'none';

  const upPreview = document.getElementById('upload-preview');
  if (upPreview) { upPreview.style.display = 'none'; upPreview.src = ''; }
  const upScanBtn = document.getElementById('scanUploadBtn');
  if (upScanBtn) upScanBtn.style.display = 'none';

  const gemPreview = document.getElementById('gemini-preview');
  if (gemPreview) { gemPreview.style.display = 'none'; gemPreview.src = ''; }
  const gemScanBtn = document.getElementById('scanGeminiBtn');
  if (gemScanBtn) gemScanBtn.style.display = 'none';
}

// Backward compatibility helper
function setMode(mode) {
  if (mode === 'manual') {
    switchAddMainTab('manual');
  } else if (mode === 'upload') {
    switchAddMainTab('camera');
    switchCameraSubTab('upload');
  } else if (mode === 'gemini') {
    switchAddMainTab('camera');
    switchCameraSubTab('bulk');
  } else {
    switchAddMainTab('camera');
    switchCameraSubTab('single');
  }
}

// ---- CAMERA ----
async function startCamera() {
  try {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (err) {
      // Fallback for laptops/desktops without an environment camera
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    }
    const video = document.getElementById('cameraStream');
    video.srcObject = cameraStream;
    video.style.display = 'block';

    const preState = document.getElementById('singlePreScanState');
    if (preState) preState.style.display = 'none';
    const activeState = document.getElementById('singleActiveStreamState');
    if (activeState) activeState.style.display = 'block';

    const captureBtn = document.getElementById('captureBtnEl');
    if (captureBtn) captureBtn.style.display = 'inline-flex';
    const scanBtn = document.getElementById('scanCameraBtn');
    if (scanBtn) scanBtn.style.display = 'none';
  } catch (e) {
    showToast('Camera access denied. Please use Upload mode instead.', 'error');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = document.getElementById('cameraStream');
  if (video) { video.style.display = 'none'; video.srcObject = null; }
}

function capturePhoto() {
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('cameraCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    capturedBlob = blob;
    const preview = document.getElementById('camera-preview');
    preview.src = URL.createObjectURL(blob);
    preview.style.display = 'block';
    
    // Hide capture button, show analyze button
    const captureBtn = document.getElementById('captureBtnEl');
    if (captureBtn) captureBtn.style.display = 'none';
    const scanBtn = document.getElementById('scanCameraBtn');
    if (scanBtn) scanBtn.style.display = 'inline-flex';
    
    stopCamera();
  }, 'image/jpeg');
}

async function scanCamera() {
  if (!capturedBlob) return showToast('No photo captured.', 'error');
  showLoading('Analyzing photo with TensorFlow Lite...');

  try {
    const form = new FormData();
    form.append('file', capturedBlob, 'capture.jpg');
    const res = await authFetch('/api/scan/cnn', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    showScanResult(`
      <div class="alert alert-success">
        <span><i class="fa-solid fa-check"></i></span>
        <div>
          <strong>${data.ingredient}</strong> detected (${data.confidence}% confidence)<br/>
          <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="addToFridge('${data.ingredient}', null, ${data.confidence})">
            <i class="fa-solid fa-plus"></i> Add to Fridge
          </button>
        </div>
      </div>`);
  } catch (e) {
    showScanResult(`<div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>Scan failed. Please try again.</div>`);
  } finally {
    hideLoading();
  }
}

// ---- UPLOAD ----
function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploadBlob = file;
  const preview = document.getElementById('upload-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('scanUploadBtn').style.display = 'block';
}

async function scanUpload() {
  if (!uploadBlob) return showToast('No image selected.', 'error');
  showLoading('Analyzing image with TensorFlow Lite...');

  try {
    const form = new FormData();
    form.append('file', uploadBlob);
    const res = await authFetch('/api/scan/cnn', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    showScanResult(`
      <div class="alert alert-success">
        <span><i class="fa-solid fa-check"></i></span>
        <div>
          <strong>${data.ingredient}</strong> detected (${data.confidence}% confidence)<br/>
          <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="addToFridge('${data.ingredient}', null, ${data.confidence})">
            <i class="fa-solid fa-plus"></i> Add to Fridge
          </button>
        </div>
      </div>`);
  } catch (e) {
    showScanResult(`<div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>Scan failed. Please try again.</div>`);
  } finally {
    hideLoading();
  }
}

// ---- GEMINI BULK SCAN ----
function handleGeminiPreview(event) {
  const file = event.target.files[0];
  if (!file) return;
  geminiBlob = file;
  const preview = document.getElementById('gemini-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('scanGeminiBtn').style.display = 'block';
}

async function scanGemini() {
  if (!geminiBlob) return showToast('No image selected.', 'error');
  showLoading('Scanning with Gemini Vision AI...');

  try {
    const form = new FormData();
    form.append('file', geminiBlob);
    const res = await authFetch('/api/scan/gemini', { method: 'POST', body: form });
    const data = await res.json();
    console.log('Gemini raw response:', data); // debug
    if (!res.ok) throw new Error(data.detail || 'Gemini API error');

    // Normalise response — backend returns string[] of item names
    const raw = data.items || [];
    if (!raw.length) {
      showScanResult('<div class="alert alert-info"><span><i class="fa-solid fa-circle-info"></i></span>No ingredients detected in the image.</div>');
      return;
    }

    // Store globally so button handlers can access safely (avoids inline JSON issues)
    window._geminiItems = raw.map(i => ({
      name: typeof i === 'string' ? i : (i.name || String(i)),
      price_rm: typeof i === 'object' ? (i.price_rm || null) : null
    }));

    let html = '<div class="alert alert-success" style="margin-bottom:16px;"><span><i class="fa-solid fa-check"></i></span><strong>Found ' + window._geminiItems.length + ' item(s)!</strong></div>';
    html += '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">';
    
    window._geminiItems.forEach((item, idx) => {
      // Sleek card layout with auto-sized buttons
      const safeName = escapeHtml(item.name);
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); padding:10px 16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <span style="font-weight:600; font-size: 0.95rem;">${safeName}</span>
          <button class="btn btn-primary btn-sm" style="width:auto; padding:6px 16px; border-radius:20px;" onclick="addGeminiItem(${idx}, this)">Add</button>
        </div>
      `;
    });
    
    html += '</div>';
    html += '<button class="btn btn-secondary" style="width:100%; padding:12px;" onclick="addAllGeminiItems()"><i class="fa-solid fa-plus"></i> Add All to Fridge</button>';
    showScanResult(html);
  } catch (e) {
    showScanResult('<div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>' + (e.message || 'Gemini scan failed.') + '</div>');
  } finally {
    hideLoading();
  }
}

function addGeminiItem(idx, btn) {
  const item = (window._geminiItems || [])[idx];
  if (!item) return;
  const success = addToFridge(item.name, item.price_rm || null);
  
  // Visual feedback on the button
  if (success && btn) {
    btn.innerHTML = 'Added <i class="fa-solid fa-check"></i>';
    btn.style.background = 'var(--success)';
    btn.style.borderColor = 'var(--success)';
    btn.disabled = true;
  }
}

function addAllGeminiItems() {
  const items = window._geminiItems || [];
  let added = 0;
  items.forEach(item => { if (addToFridge(item.name, item.price_rm || null)) added++; });
  showToast(added + ' ingredient(s) added to fridge.', 'success');
}

// ---- MANUAL ADD ----
function addManual() {
  const input = document.getElementById('manualInput');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return showToast('Please type an ingredient name.', 'error');
  const formatted = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  addToFridge(formatted, null);
  input.value = '';
}

// ---- INIT ----
renderFridge();

// Allow Enter key in manual input
setTimeout(() => {
  const input = document.getElementById('manualInput');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addManual(); });
}, 500);