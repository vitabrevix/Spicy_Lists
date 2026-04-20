const CUSTOM_PRESETS_KEY = 'spicyLists_customPresets';

function showPresetPopover(msg) {
  let pop = document.getElementById('preset-popover');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'preset-popover';
    pop.style.cssText = [
      'position:fixed', 'z-index:9999',
      'background:var(--bg-card,#2a2a2a)', 'color:var(--text,#eee)',
      'border:0.5px solid var(--border,#444)', 'border-radius:8px',
      'padding:7px 13px', 'font-size:13px', 'pointer-events:none',
      'white-space:nowrap', 'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
      'opacity:0', 'transition:opacity 0.3s ease',
    ].join(';');
    document.body.appendChild(pop);
  }

  const anchor = document.getElementById('premade-wrapper');
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    pop.style.top  = (r.bottom + 8) + 'px';
    pop.style.left = r.left + 'px';
  }

  pop.textContent = msg;
  //Force reflow so opacity transition fires on repeated calls
  pop.style.opacity = '0';
  pop.offsetHeight;
  pop.style.opacity = '1';

  clearTimeout(pop._fadeTimer);
  pop._fadeTimer = setTimeout(() => { pop.style.opacity = '0'; }, 2500);
}

function loadCustomPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveCustomPresetsToStorage(presets) {
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {}
}

function deleteCustomPreset(name) {
  const presets = loadCustomPresetsFromStorage().filter(p => p.name !== name);
  saveCustomPresetsToStorage(presets);
  populateSelect(_currentFilenames || []);
}

function loadCustomPresetAdd(name) {
  const presets = loadCustomPresetsFromStorage();
  const found = presets.find(p => p.name === name);
  if (!found) return;
  closeCustomDropdown();
  applyPresetData(found.data, 'add', name);
}

function loadCustomPresetReplace(name) {
  const presets = loadCustomPresetsFromStorage();
  const found = presets.find(p => p.name === name);
  if (!found) return;
  closeCustomDropdown();
  applyPresetData(found.data, 'replace', name);
}

function importCustomPreset() {
  closeCustomDropdown();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files).filter(f => f.name.endsWith('.json'));
    if (files.length === 0) return;
    const existing = loadCustomPresetsFromStorage();
    for (const file of files) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const name = file.name.replace(/\.json$/i, '');
        const idx = existing.findIndex(p => p.name === name);
        if (idx !== -1) {
          existing[idx] = { name, data };
        } else {
          existing.push({ name, data });
        }
        showPresetPopover(`Saved "${name}" to presets`);
      } catch (err) {
        showPresetPopover(`Could not read ${file.name}`);
      }
    }
    saveCustomPresetsToStorage(existing);
    populateSelect(_currentFilenames || []);
  };
  input.click();
}

let _currentFilenames = [];

function populateSelect(filenames) {
  _currentFilenames = filenames;
  const menu = document.getElementById('custom-dropdown-menu');
  const dropdown = document.getElementById('custom-dropdown');
  const folderBtn = document.getElementById('premade-folder-btn');
  menu.innerHTML = '';

  const sorted = filenames.slice().sort((a, b) => {
    const aPin = a.startsWith('_') ? 0 : 1;
    const bPin = b.startsWith('_') ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;
    return a.localeCompare(b);
  });

  const hasPinned   = sorted.some(f => f.startsWith('_'));
  const hasUnpinned = sorted.some(f => !f.startsWith('_'));
  let separatorAdded = false;

  sorted.forEach(filename => {
    const raw   = filename.replace(/\.json$/i, '');
    const label = raw.startsWith('_') ? raw.slice(1) : raw;

    if (hasPinned && hasUnpinned && !filename.startsWith('_') && !separatorAdded) {
      const sep = document.createElement('div');
      sep.className = 'custom-dropdown-separator';
      menu.appendChild(sep);
      separatorAdded = true;
    }

    const item = document.createElement('div');
    item.className = 'custom-dropdown-item';
    item.innerHTML = `
      <span class="custom-dropdown-item-label">${label}</span>
      <button class="custom-dropdown-replace-btn" title="Replace all">&#x1F504;</button>`;
    item.querySelector('.custom-dropdown-item-label').addEventListener('click', () => {
      closeCustomDropdown();
      loadPremadeAdd(filename);
    });
    item.querySelector('.custom-dropdown-replace-btn').addEventListener('click', e => {
      e.stopPropagation();
      closeCustomDropdown();
      loadPremadeReplace(filename);
    });
    menu.appendChild(item);
  });

  // Custom (saved) presets from localStorage
  const customPresets = loadCustomPresetsFromStorage();
  if (customPresets.length > 0) {
    const sep = document.createElement('div');
    sep.className = 'custom-dropdown-separator';
    menu.appendChild(sep);

    customPresets.forEach(preset => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item';
      item.innerHTML = `
        <span class="custom-dropdown-item-label custom-preset-label">&#128190; ${preset.name}</span>
        <button class="custom-dropdown-replace-btn" title="Replace all">&#x1F504;</button>
        <button class="custom-dropdown-delete-btn" title="Delete from memory">&#x1F5D1;</button>`;
      item.querySelector('.custom-preset-label').addEventListener('click', () => {
        loadCustomPresetAdd(preset.name);
      });
      item.querySelector('.custom-dropdown-replace-btn').addEventListener('click', e => {
        e.stopPropagation();
        loadCustomPresetReplace(preset.name);
      });
      item.querySelector('.custom-dropdown-delete-btn').addEventListener('click', e => {
        e.stopPropagation();
        deleteCustomPreset(preset.name);
      });
      menu.appendChild(item);
    });
  }

  // Import JSON footer item
  const footerSep = document.createElement('div');
  footerSep.className = 'custom-dropdown-separator';
  menu.appendChild(footerSep);

  const importItem = document.createElement('div');
  importItem.className = 'custom-dropdown-item custom-dropdown-import-item';
  importItem.innerHTML = `<span class="custom-dropdown-import-label">&#x1F4E5; Import JSON&#x2026;</span>`;
  importItem.addEventListener('click', () => {
    importCustomPreset();
  });
  menu.appendChild(importItem);

  //Only hide the folder picker button when real server/folder presets are present.
  if (filenames.length > 0) {
    folderBtn.style.display = 'none';
  } else {
    folderBtn.style.display = '';
  }
  dropdown.style.display = '';
}

function toggleCustomDropdown() {
  const menu = document.getElementById('custom-dropdown-menu');
  dropdownOpen = !dropdownOpen;
  menu.classList.toggle('open', dropdownOpen);
}

function closeCustomDropdown() {
  dropdownOpen = false;
  const menu = document.getElementById('custom-dropdown-menu');
  if (menu) menu.classList.remove('open');
}

async function fetchPresetData(filename) {
  if (location.protocol === 'file:') {
    const file = fileMap[filename];
    if (!file) throw new Error('File not in map');
    return JSON.parse(await file.text());
  } else {
    const url = `./premade/${encodeURIComponent(filename)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text());
  }
}

async function initPremade() {
  if (location.protocol === 'file:') {
    //Still show the dropdown so custom (saved) presets are accessible
    populateSelect([]);
    return;
  }

  // URL Preset + Dot Loading
  // ?p=Name1,Name2 loads presets in order (first = replace, rest = add).
  // ?d=<encoded> restores selected dot values after all presets are applied.
  const urlParams = new URLSearchParams(location.search);
  const pParam = urlParams.get('p');
  const dParam = urlParams.get('d');
  const bParam = urlParams.get('b');
  const urlPresetNames = pParam
    ? pParam.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  if (urlPresetNames.length > 0) {
    //Load presets specified by URL, skip _Default
    for (let i = 0; i < urlPresetNames.length; i++) {
      const name = urlPresetNames[i];
      //Try both plain name and _-prefixed variant as filenames
      const candidates = [`_${name}.json`, `${name}.json`];
      let loaded = false;
      for (const filename of candidates) {
        try {
          const data = await fetchPresetData(filename);
          applyPresetData(data, i === 0 ? 'replace' : 'add', name);
          loaded = true;
          break;
        } catch (e) {
          //Try next candidate
        }
      }
      if (!loaded) {
        showPresetPopover(`Could not load preset "${name}" from URL`);
      }
    }
  } else {
    //Default: load _Default.json
    try {
      const defData = await fetchPresetData('_Default.json');
      const parsedLegend = parseLegend(defData);
      if (parsedLegend) legend = parsedLegend;
      applyPresetData(defData, 'replace', '_Default');
      //Remove _Default from activePresetNames — it's the implicit baseline, not shareable
      activePresetNames = [];
    } catch (e) {
    }
  }

  //Apply encoded dot selections from URL after all list/legend state is settled
  if (dParam) {
    applyEncodedDots(dParam);
    if (bParam) applyEncodedBlends(bParam);
    render();
  }

  try {
    const res = await fetch('./premade/index.json');
    if (!res.ok) {
      populateSelect([]);
      return;
    }
    const files = await res.json();
    populateSelect(Array.isArray(files) ? files : []);
  } catch (e) {
    console.warn('Could not load premade/index.json:', e);
    populateSelect([]);
  }
}

function pickPremadeFolder() {
  document.getElementById('premade-folder-input').click();
}

async function onFolderPicked(input) {
  const jsonFiles = Array.from(input.files).filter(f =>
    f.name.endsWith('.json') && f.name !== 'index.json'
  );
  if (jsonFiles.length === 0) return;
  jsonFiles.forEach(f => { fileMap[f.name] = f; });

  const defaultFile = jsonFiles.find(f => f.name === '_Default.json');
  if (defaultFile) {
    try {
      const data = JSON.parse(await defaultFile.text());
      const parsedLegend = parseLegend(data);
      if (parsedLegend) legend = parsedLegend;
      applyPresetData(data, 'replace', '_Default');
      //Do not expose _Default in activePresetNames since it is the implicit baseline
      activePresetNames = [];
    } catch (e) {
      console.warn('Could not parse _Default.json:', e);
    }
  }

  populateSelect(jsonFiles.map(f => f.name));
}

async function loadPremadeAdd(filename) {
  if (!filename) return;
  try {
    const data = await fetchPresetData(filename);
    const name = filename.replace(/\.json$/i, '').replace(/^_/, '');
    applyPresetData(data, 'add', name);
  } catch (e) {
    alert(`Could not load preset "${filename}".`);
  }
}

async function loadPremadeReplace(filename) {
  if (!filename) return;
  try {
    const data = await fetchPresetData(filename);
    const name = filename.replace(/\.json$/i, '').replace(/^_/, '');
    applyPresetData(data, 'replace', name);
  } catch (e) {
    alert(`Could not load preset "${filename}".`);
  }
}
