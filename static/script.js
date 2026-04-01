document.addEventListener("DOMContentLoaded", () => {

const API = 'http://localhost:5000';
let selectedFile = null;
let currentLang  = 'en';   // 'en' | 'mr'
let lastData     = null;   // store last API response for re-render on lang switch

// ── Language Toggle ───────────────────────────────────────
const langToggle = document.getElementById('langToggle');
const langLabel  = document.getElementById('langLabel');

langToggle.addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'mr' : 'en';
  langLabel.textContent = currentLang === 'en' ? 'मराठी' : 'English';
  applyLang();
  if (lastData) renderResult(lastData); // re-render dynamic result in new lang
});

/**
 * Walk every element that has data-en / data-mr and swap its textContent.
 * Works for both <button> labels and regular text nodes.
 */
function applyLang() {
  document.querySelectorAll('[data-en][data-mr]').forEach(el => {
    el.innerHTML = el.getAttribute(`data-${currentLang}`);
  });
}

// ── Marathi translations for dynamic (API-driven) content ──
const RISK_LABELS_MR = {
  "High Risk":     "उच्च धोका",
  "Moderate Risk": "मध्यम धोका",
  "Low Risk":      "कमी धोका",
  "Healthy":       "निरोगी",
};

// ── Drag & Drop ──────────────────────────────────────────
const zone = document.getElementById('uploadZone');

zone.addEventListener('dragover', e => {
  e.preventDefault();
  zone.style.background   = '#f0fff4';
  zone.style.borderColor  = '#28a745';
});
zone.addEventListener('dragleave', () => {
  zone.style.background  = '';
  zone.style.borderColor = '';
});
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.style.background  = '';
  zone.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
  else alert(currentLang === 'mr' ? 'कृपया एक प्रतिमा फाइल टाका.' : 'Please drop an image file.');
});
zone.addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('resetBtn').addEventListener('click', reset);

document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// ── Handle selected file ─────────────────────────────────
function handleFile(file) {
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('previewImg').src = ev.target.result;
    show('previewSection');
    hide('resultCard');
    hide('loading');
  };
  reader.readAsDataURL(file);
}

// ── Analyze ──────────────────────────────────────────────
async function analyze() {
  if (!selectedFile) return;

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  show('loading');
  hide('resultCard');

  const formData = new FormData();
  formData.append('image', selectedFile);

  try {
    const res  = await fetch(`${API}/predict`, { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert((currentLang === 'mr' ? 'त्रुटी: ' : 'Error: ') + (data.error || (currentLang === 'mr' ? 'काहीतरी चुकले.' : 'Something went wrong.')));
      return;
    }

    lastData = data;
    renderResult(data);
    show('resultCard');

  } catch (err) {
    if (currentLang === 'mr') {
      alert('❌ बॅकएंडशी कनेक्ट होता येत नाही.\nFlask चालू असल्याची खात्री करा:\n  cd backend\n  python app.py');
    } else {
      alert('❌ Cannot reach backend.\nMake sure Flask is running:\n  cd backend\n  python app.py');
    }
    console.error(err);
  } finally {
    hide('loading');
    btn.disabled = false;
  }
}

// ── Render Result ────────────────────────────────────────
function renderResult(data) {
  const isMr = currentLang === 'mr';

  // ── Risk Banner ──
  const banner = document.getElementById('riskBanner');
  banner.style.background = data.risk.bg;
  banner.style.borderLeft = `5px solid ${data.risk.color}`;
  document.getElementById('riskEmoji').textContent = data.risk.emoji;

  const riskLabelEl = document.getElementById('riskLabel');
  riskLabelEl.style.color = data.risk.color;
  riskLabelEl.textContent = isMr
    ? (RISK_LABELS_MR[data.risk.label] || data.risk.label)
    : data.risk.label;

  document.getElementById('riskSublabel').textContent = isMr
    ? (data.disease.display_name_mr || data.disease.display_name)
    : data.disease.display_name;

  // ── Disease Card ──
  document.getElementById('diseaseName').textContent = isMr
    ? (data.disease.display_name_mr || data.disease.display_name)
    : data.disease.display_name;

  document.getElementById('cropTag').textContent = '🌱 ' + (isMr
    ? (data.disease.crop_mr || data.disease.crop)
    : data.disease.crop);

  document.getElementById('description').textContent = isMr
    ? (data.disease.description_mr || data.disease.description)
    : data.disease.description;

  document.getElementById('treatment').textContent = isMr
    ? (data.disease.treatment_mr || data.disease.treatment)
    : data.disease.treatment;

  // ── Confidence ──
  const conf   = data.confidence;
  const circle = document.getElementById('confCircle');
  circle.textContent   = conf + '%';
  circle.style.background = `conic-gradient(${data.risk.color} ${conf}%, #e9ecef ${conf}%)`;

  document.getElementById('confFill').style.width = conf + '%';
  document.getElementById('confText').textContent  = conf + '%';

  // ── Top 5 ──
  const list = document.getElementById('top5List');
  list.innerHTML = data.top5.map((item, i) => {
    const pct  = (item.confidence * 100).toFixed(1);
    // Use Marathi class name if available, else prettify English key
    const name = isMr
      ? (item.class_mr || item.class.replace(/_/g, ' '))
      : item.class.replace(/_/g, ' ');
    const bold = i === 0 ? 'font-weight:700;color:#1a6b3c;' : '';
    return `
      <div class="top5-item">
        <span class="top5-name" style="${bold}" title="${name}">${name}</span>
        <div class="top5-bar">
          <div class="top5-fill" style="width:${pct}%;${i===0?'background:#68d391':''}"></div>
        </div>
        <span class="top5-pct">${pct}%</span>
      </div>`;
  }).join('');

  // Re-apply static lang strings that live inside result card
  applyLang();
}

// ── Reset ────────────────────────────────────────────────
function reset() {
  selectedFile = null;
  lastData     = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('previewImg').src  = '';
  hide('previewSection');
  hide('resultCard');
  hide('loading');
}

// ── Helpers ──────────────────────────────────────────────
function show(id) { document.getElementById(id).style.display = 'block'; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

});