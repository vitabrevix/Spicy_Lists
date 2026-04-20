// Dot State Encoding
// d= packs multiple dot selections into each character.
// b= stores only the blend cells that actually exist, as a sparse sequence.

const DOT_ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DOT_BASE  = DOT_ALPHA.length; // 62

function _alphaEncode(n, chars) {
  if (chars === 1) return DOT_ALPHA[Math.min(n, DOT_BASE - 1)] || '0';
  const hi = Math.floor(n / DOT_BASE);
  const lo = n % DOT_BASE;
  return DOT_ALPHA[Math.min(hi, DOT_BASE - 1)] + DOT_ALPHA[lo];
}

function _alphaDecode(s) {
  if (s.length === 1) { const v = DOT_ALPHA.indexOf(s); return v < 0 ? 0 : v; }
  const hi = DOT_ALPHA.indexOf(s[0]);
  const lo = DOT_ALPHA.indexOf(s[1]);
  return (hi < 0 ? 0 : hi) * DOT_BASE + (lo < 0 ? 0 : lo);
}

function _charsFor(maxVal) { return maxVal < DOT_BASE ? 1 : 2; }

// How many dot values fit inside one base-62 character for a given legend size.
function _dotsPerChar(L) {
  if (L <= 1) return 1;
  return Math.max(1, Math.floor(Math.log(DOT_BASE) / Math.log(L)));
}

// Encode a flat array of dot integers (0..L-1) into a packed char string.
function _packDots(values, L) {
  const dpc = _dotsPerChar(L);
  let out = '';
  for (let i = 0; i < values.length; i += dpc) {
    let charVal = 0;
    let mult = 1;
    for (let j = 0; j < dpc; j++) {
      charVal += (values[i + j] || 0) * mult;
      mult *= L;
    }
    out += DOT_ALPHA[charVal] || '0';
  }
  return out;
}

// Decode a packed char string back into a flat array of dot integers.
function _unpackDots(str, L, totalDots) {
  const dpc = _dotsPerChar(L);
  const out  = [];
  for (let i = 0; i < str.length && out.length < totalDots; i++) {
    let charVal = DOT_ALPHA.indexOf(str[i]);
    if (charVal < 0) charVal = 0;
    for (let j = 0; j < dpc && out.length < totalDots; j++) {
      out.push(charVal % L);
      charVal = Math.floor(charVal / L);
    }
  }
  // Pad with 0 if the string was shorter than expected
  while (out.length < totalDots) out.push(0);
  return out;
}

// d= : all dot values packed as a single base-62 stream (no separators).
// Uses mixed-radix packing: floor(log(62)/log(L)) dot values per char.
// Zero is the default value and trailing zeros are omitted — on decode,
// any position past the end of the string is treated as 0.
// Blend cells are stored as 0 here and overridden by b=.
function encodeDotSelections() {
  const L = legend.length;
  const allValues = [];
  lists.forEach(list =>
    list.items.forEach(item =>
      list.columns.forEach((_, ci) => {
        const v = item.dots[ci];
        if (typeof v === 'object' && v !== null) { allValues.push(0); return; }
        allValues.push(typeof v === 'number' ? Math.max(0, Math.min(v, L - 1)) : 0);
      })
    )
  );
  // Trim trailing zeros so all-default state produces an empty string
  while (allValues.length > 0 && allValues[allValues.length - 1] === 0) allValues.pop();
  if (allValues.length === 0) return '';
  return _packDots(allValues, L);
}

// b= : sparse blend entries only
function encodeBlends() {
  const L     = legend.length;
  const ssMax = (L - 1) * (L - 1) - 1;
  const ssCpd = _charsFor(ssMax);
  let out = '';
  lists.forEach((list, li) => {
    list.items.forEach((item, ii) => {
      list.columns.forEach((_, ci) => {
        const v = item.dots[ci];
        if (typeof v !== 'object' || v === null) return;
        const a  = v.a, b = v.b;
        const ss = a * (L - 1) + (b - a - 1);
        out += _alphaEncode(li, 1)
             + _alphaEncode(ii, 1)
             + _alphaEncode(ci, 1)
             + _alphaEncode(ss, ssCpd);
      });
    });
  });
  return out;
}

// Apply d= string back onto current lists (single selections only).
// Positions past the end of the encoded string default to 0.
function applyEncodedDots(encoded) {
  if (!encoded) return;
  const L = legend.length;
  const totalDots = lists.reduce((s, list) => s + list.items.length * list.columns.length, 0);
  const flat = _unpackDots(encoded, L, totalDots);
  let cursor = 0;
  lists.forEach(list =>
    list.items.forEach(item =>
      list.columns.forEach((_, ci) => {
        item.dots[ci] = flat[cursor++] || 0;
      })
    )
  );
}

// Apply b= string back onto current lists (blends, overrides any d= value for that cell).
function applyEncodedBlends(encoded) {
  if (!encoded) return;
  const L = legend.length;
  const ssMax = (L - 1) * (L - 1) - 1;
  const ssCpd = _charsFor(ssMax);
  const stride = 3 + ssCpd; // LI + II + CI + SS
  for (let i = 0; i + stride <= encoded.length; i += stride) {
    const li  = _alphaDecode(encoded[i]);
    const ii  = _alphaDecode(encoded[i + 1]);
    const ci  = _alphaDecode(encoded[i + 2]);
    const ss  = _alphaDecode(encoded.slice(i + 3, i + 3 + ssCpd));
    const a   = Math.floor(ss / (L - 1));
    const b   = a + 1 + (ss % (L - 1));
    const list = lists[li];
    if (!list) continue;
    const item = list.items[ii];
    if (!item) continue;
    if (ci >= list.columns.length) continue;
    item.dots[ci] = { a, b };
  }
}

// Share URL
function buildShareUrl() {
  const base = location.origin + location.pathname;
  const parts = [];
  if (activePresetNames.length > 0) {
    parts.push('p=' + activePresetNames.map(n => encodeURIComponent(n)).join(','));
  }
  const dotStr = encodeDotSelections();
  if (dotStr) parts.push('d=' + dotStr);
  const blendStr = encodeBlends();
  if (blendStr) parts.push('b=' + blendStr);
  if (parts.length === 0) return base;
  return base + '?' + parts.join('&');
}

async function copyShareUrl() {
  const url = buildShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    showShareCopied();
  } catch (e) {
    //Fallback: prompt with the URL so the user can copy manually
    prompt('Copy this share URL:', url);
  }
}

function showShareCopied() {
  const btn = document.getElementById('share-btn');
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = 'Copied!';
  btn.style.background = '#ddeeff';
  btn.style.color = '#1a5fa8';
  btn.style.borderColor = '#7ab4e8';
  setTimeout(() => {
    btn.textContent = prev;
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
  }, 1800);
}
