const PRESET_COLORS = [
  '#888888','#4a90d9','#3dba6f','#b08030','#cc6820','#c0392b',
  '#9b59b6','#1abc9c','#e67e22','#e91e8c','#2ecc71','#e74c3c',
  '#3498db','#f39c12','#16a085','#8e44ad',
];

let nid = 1;
const id = () => nid++;

let globalEditing = false;
let openColorPicker = null;
let openColorPickerPos = null;
let dragSrc = null;
let dragSrcList = null;
let darkMode = false;
let dropdownOpen = false;

const loadedPresetFingerprints = new Set();

const fileMap = {};

let legend = [
  { id: id(), name: 'Not set',     color: '#888888' },
  { id: id(), name: 'Favorite',    color: '#4a90d9' },
  { id: id(), name: 'Like',        color: '#3dba6f' },
  { id: id(), name: 'Indifferent', color: '#b08030' },
  { id: id(), name: 'Maybe',       color: '#cc6820' },
  { id: id(), name: 'Limit',       color: '#c0392b' },
];

let lists = [];

function presetFingerprint(data) {
  if (!Array.isArray(data.lists)) return '';
  return data.lists.map(l => {
    const items = Array.isArray(l.items)
      ? l.items.map(i => i.label || '').join('|')
      : '';
    return (l.name || '') + ':' + items;
  }).join(';;');
}

function parseLists(data) {
  if (!Array.isArray(data.lists)) return [];
  return data.lists.map(l => ({
    id: id(),
    name: l.name || 'Untitled',
    columns: Array.isArray(l.columns) ? l.columns : [],
    items: Array.isArray(l.items) ? l.items.map(item => ({
      id: id(),
      label: item.label || '',
      desc: item.desc || '',
      dots: Array.isArray(item.dots) ? item.dots : []
    })) : []
  }));
}

function parseLegend(data) {
  if (!Array.isArray(data.legend) || data.legend.length === 0) return null;
  return data.legend.map(entry => ({
    id: id(),
    name: entry.name || 'Unnamed',
    color: entry.color || '#888888'
  }));
}

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

function applyPresetData(data, mode) {
  const parsed = parseLists(data);
  if (mode === 'replace') {
    lists = parsed;
    const parsedLegend = parseLegend(data);
    if (parsedLegend) legend = parsedLegend;
    loadedPresetFingerprints.clear();
    loadedPresetFingerprints.add(presetFingerprint(data));
  } else {
    if (parsed.length === 0) return;
    const existingNames = new Set(lists.map(l => l.name.trim().toLowerCase()));
    const toAdd   = parsed.filter(l => !existingNames.has(l.name.trim().toLowerCase()));
    const skipped = parsed.length - toAdd.length;

    if (toAdd.length === 0) {
      showPresetPopover('All lists already added');
      return;
    }
    if (skipped > 0) {
      const s = skipped === 1 ? '1 list' : `${skipped} lists`;
      showPresetPopover(`${s} already present, skipped`);
    }
    loadedPresetFingerprints.add(presetFingerprint(data));
    lists = lists.concat(toAdd);
  }
  render();
}

function populateSelect(filenames) {
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
  dropdown.style.display = '';
  folderBtn.style.display = 'none';
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
    const res = await fetch(`./premade/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}

async function initPremade() {
  if (location.protocol === 'file:') return;
  try {
    const defData = await fetchPresetData('Default.json');
    const parsedLegend = parseLegend(defData);
    if (parsedLegend) legend = parsedLegend;
    applyPresetData(defData, 'replace');
  } catch (e) {
  }
  try {
    const res = await fetch('./premade/index.json');
    if (!res.ok) return;
    const files = await res.json();
    if (!Array.isArray(files) || files.length === 0) return;
    populateSelect(files);
  } catch (e) {
    console.warn('Could not load premade/index.json:', e);
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

  const defaultFile = jsonFiles.find(f => f.name === 'Default.json');
  if (defaultFile) {
    try {
      const data = JSON.parse(await defaultFile.text());
      const parsedLegend = parseLegend(data);
      if (parsedLegend) legend = parsedLegend;
      applyPresetData(data, 'replace');
    } catch (e) {
      console.warn('Could not parse Default.json:', e);
    }
  }

  populateSelect(jsonFiles.map(f => f.name));
}

async function loadPremadeAdd(filename) {
  if (!filename) return;
  try {
    const data = await fetchPresetData(filename);
    applyPresetData(data, 'add');
  } catch (e) {
    alert(`Could not load preset "${filename}".`);
  }
}

async function loadPremadeReplace(filename) {
  if (!filename) return;
  try {
    const data = await fetchPresetData(filename);
    applyPresetData(data, 'replace');
  } catch (e) {
    alert(`Could not load preset "${filename}".`);
  }
}

function toggleGlobalEdit() {
  globalEditing = !globalEditing;
  openColorPicker = null;
  render();
}

function positionColorPicker() {
  const popup = document.getElementById('color-picker-portal');
  if (!popup || !openColorPickerPos) return;
  popup.style.top = openColorPickerPos.top + 'px';
  let left = openColorPickerPos.left;
  const popupW = 148;
  if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
  popup.style.left = left + 'px';
}

function addLegendItem() {
  const inp = document.getElementById('new-legend-name');
  const name = inp.value.trim();
  if (!name) return;
  const color = PRESET_COLORS[legend.length % PRESET_COLORS.length];
  legend.push({ id: id(), name, color });
  inp.value = '';
  render();
}

function removeLegendItem(lid) {
  const idx = legend.findIndex(x => x.id === lid);
  if (idx === -1) return;
  legend.splice(idx, 1);
  lists.forEach(l => l.items.forEach(item => {
    item.dots = item.dots.map(d => d >= legend.length ? legend.length - 1 : d);
  }));
  render();
}

function renameLegend(lid, val) {
  const l = legend.find(x => x.id === lid);
  if (l) l.name = val;
}

function setLegendColor(lid, color) {
  const l = legend.find(x => x.id === lid);
  if (l) l.color = color;
  openColorPicker = null;
  openColorPickerPos = null;
  render();
}

function toggleColorPicker(lid, btnEl) {
  if (openColorPicker === lid) {
    openColorPicker = null;
    openColorPickerPos = null;
  } else {
    openColorPicker = lid;
    const rect = btnEl.getBoundingClientRect();
    openColorPickerPos = {
      top: rect.bottom + 6,
      left: rect.left,
    };
  }
  render();
  if (openColorPicker !== null) positionColorPicker();
}

function onDragStart(e, lid) {
  dragSrc = lid;
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e, lid) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDrop(e, lid) {
  e.preventDefault();
  if (dragSrc === lid) return;
  const fromIdx = legend.findIndex(x => x.id === dragSrc);
  const toIdx   = legend.findIndex(x => x.id === lid);
  const [moved] = legend.splice(fromIdx, 1);
  legend.splice(toIdx, 0, moved);
  dragSrc = null;
  render();
}

function onListDragStart(e, lid) {
  dragSrcList = lid;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('list-dragging');
}

function onListDragEnd(e) {
  dragSrcList = null;
  document.querySelectorAll('.list-block').forEach(b => {
    b.classList.remove('list-dragging', 'list-drag-over');
  });
}

function onListDragOver(e, lid) {
  if (dragSrcList === null || dragSrcList === lid) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.list-block').forEach(b => b.classList.remove('list-drag-over'));
  const target = document.querySelector(`.list-block[data-lid="${lid}"]`);
  if (target) target.classList.add('list-drag-over');
}

function onListDrop(e, lid) {
  e.preventDefault();
  if (dragSrcList === null || dragSrcList === lid) return;
  const fromIdx = lists.findIndex(x => x.id === dragSrcList);
  const toIdx   = lists.findIndex(x => x.id === lid);
  const [moved] = lists.splice(fromIdx, 1);
  lists.splice(toIdx, 0, moved);
  dragSrcList = null;
  render();
}

function addList() {
  const inp = document.getElementById('new-list-name');
  const name = inp.value.trim();
  if (!name) return;
  lists.push({ id: id(), name, columns: [], items: [] });
  inp.value = '';
  render();
}

function removeList(lid) {
  lists = lists.filter(l => l.id !== lid);
  render();
}

function addItem(lid) {
  const inp = document.getElementById(`add-item-input-${lid}`);
  if (!inp) return;
  const label = inp.value.trim();
  if (!label) return;
  const l = lists.find(x => x.id === lid);
  l.items.push({ id: id(), label, desc: '', dots: l.columns.map(() => 0) });
  inp.value = '';
  inp.focus();
  render();
}

function removeItem(lid, iid) {
  const l = lists.find(x => x.id === lid);
  l.items = l.items.filter(i => i.id !== iid);
  render();
}

function addColumn(lid) {
  const inp = document.getElementById(`add-col-input-${lid}`);
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) return;
  const l = lists.find(x => x.id === lid);
  l.columns.push(name);
  l.items.forEach(i => i.dots.push(0));
  inp.value = '';
  inp.focus();
  render();
}

function removeColumn(lid, ci) {
  const l = lists.find(x => x.id === lid);
  l.columns.splice(ci, 1);
  l.items.forEach(i => i.dots.splice(ci, 1));
  render();
}

function cycleDot(lid, iid, ci, li) {
  const l    = lists.find(x => x.id === lid);
  const item = l.items.find(i => i.id === iid);
  const cur = item.dots[ci];
  const curSingle = (typeof cur === 'object' && cur !== null) ? null : cur;
  if (curSingle === li) {
    item.dots[ci] = 0;
  } else {
    item.dots[ci] = li;
  }
  render();
}

function setDotBlend(lid, iid, ci, a, b) {
  const l    = lists.find(x => x.id === lid);
  const item = l.items.find(i => i.id === iid);
  if (a === b) {
    item.dots[ci] = a;
  } else {
    item.dots[ci] = { a: Math.min(a, b), b: Math.max(a, b) };
  }
  render();
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderLegend() {
  const bar = document.getElementById('legend-bar');

  let html = `<div class="legend-header">
    <span>Legend</span>
    <div class="legend-items" id="legend-items">`;

  legend.forEach(item => {
    html += `<div class="legend-pill${dragSrc === item.id ? ' dragging' : ''}"
      id="pill-${item.id}"
      ${globalEditing ? `draggable="true"
        ondragstart="onDragStart(event,${item.id})"
        ondragover="onDragOver(event,${item.id})"
        ondrop="onDrop(event,${item.id})"` : ''}>`;

    if (globalEditing) {
      html += `<div class="pill-dot" style="background:${item.color}" title="Drag to reorder"></div>
        <input class="pill-name" type="text" value="${esc(item.name)}"
          onchange="renameLegend(${item.id},this.value)"
          oninput="renameLegend(${item.id},this.value)" />
        <div class="pill-color-btn" style="background:${item.color}"
          onclick="toggleColorPicker(${item.id},this)" title="Change color"></div>
        <button class="pill-del" onclick="removeLegendItem(${item.id})">X</button>`;
    } else {
      html += `<div class="pill-dot" style="background:${item.color}; cursor:default;"></div>
        <span>${esc(item.name)}</span>`;
    }

    html += `</div>`;
  });

  html += `</div></div>`;

  if (globalEditing) {
    html += `<div class="legend-edit-bar">
      <input type="text" id="new-legend-name" placeholder="New option name..." />
      <button onclick="addLegendItem()">+ option</button>
    </div>`;
  } else {
    html += `<div style="margin-top:6px;font-size:11px;color:#aaa;font-style:italic;">
      Click a dot to select it &nbsp;&middot;&nbsp; Hold &amp; drag across two dots to mark a blend
    </div>`;
  }

  bar.innerHTML = html;

  let portal = document.getElementById('color-picker-portal');
  if (openColorPicker !== null) {
    const item = legend.find(x => x.id === openColorPicker);
    if (item) {
      if (!portal) {
        portal = document.createElement('div');
        portal.id = 'color-picker-portal';
        portal.className = 'color-picker-popup';
        document.body.appendChild(portal);
      }
      let swatches = '';
      PRESET_COLORS.forEach(c => {
        swatches += `<div class="cp-swatch" style="background:${c};${item.color === c ? 'border-color:#333;' : ''}"
          onclick="setLegendColor(${item.id},'${c}')"></div>`;
      });
      portal.innerHTML = swatches;
      portal.style.display = 'flex';
    }
  } else {
    if (portal) portal.style.display = 'none';
  }
}


function buildLabelCell(item) {
  const wrap = document.createElement('div');
  wrap.className = 'label-cell';
  const nameSpan = document.createElement('span');
  nameSpan.textContent = item.label;
  wrap.appendChild(nameSpan);

  if (item.desc) {
    const dot = document.createElement('span');
    dot.className = 'info-dot';
    dot.textContent = 'i';
    dot.setAttribute('tabindex', '0');

    const showPop = () => {
      let pop = document.getElementById('desc-popover');
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 'desc-popover';
        pop.style.cssText = [
          'position:fixed', 'z-index:9999',
          'background:var(--bg-card,#2a2a2a)', 'color:var(--text,#eee)',
          'border:0.5px solid var(--border,#444)', 'border-radius:8px',
          'padding:7px 12px', 'font-size:12px', 'max-width:240px',
          'white-space:normal', 'line-height:1.5',
          'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
          'pointer-events:none', 'opacity:0',
          'transition:opacity 0.2s ease',
        ].join(';');
        document.body.appendChild(pop);
      }
      pop.textContent = item.desc;
      const r = dot.getBoundingClientRect();
      pop.style.opacity = '0';
      pop.style.display = 'block';
      const popW = pop.offsetWidth;
      const popH = pop.offsetHeight;
      let left = r.right + 8;
      if (left + popW > window.innerWidth - 8) left = r.left - popW - 8;
      let top = r.top - popH / 2 + r.height / 2;
      if (top < 4) top = 4;
      if (top + popH > window.innerHeight - 4) top = window.innerHeight - popH - 4;
      pop.style.left = left + 'px';
      pop.style.top  = top  + 'px';
      pop.offsetHeight;
      pop.style.opacity = '1';
    };

    const hidePop = () => {
      const pop = document.getElementById('desc-popover');
      if (pop) pop.style.opacity = '0';
    };

    dot.addEventListener('mouseenter', showPop);
    dot.addEventListener('mouseleave', hidePop);
    dot.addEventListener('focus',      showPop);
    dot.addEventListener('blur',       hidePop);
    dot.addEventListener('click', e => {
      e.stopPropagation();
      const pop = document.getElementById('desc-popover');
      if (pop && pop.style.opacity === '1') hidePop(); else showPop();
    });

    wrap.appendChild(dot);
  }

  return wrap;
}

function renderLists() {
  const grid = document.getElementById('lists-grid');
  grid.innerHTML = '';

  lists.forEach(list => {
    const block = document.createElement('div');
    block.className = 'list-block';
    block.dataset.lid = list.id;

    if (globalEditing) {
      block.draggable = true;
      block.addEventListener('dragstart', e => onListDragStart(e, list.id));
      block.addEventListener('dragend',   e => onListDragEnd(e));
      block.addEventListener('dragover',  e => onListDragOver(e, list.id));
      block.addEventListener('drop',      e => onListDrop(e, list.id));
    }

    const titleRow = document.createElement('div');
    titleRow.className = 'list-title-row';
    titleRow.innerHTML = `
      ${globalEditing ? `<span class="list-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>` : ''}
      <h2>${esc(list.name)}</h2>
      ${globalEditing ? `<button class="delete-btn" onclick="removeList(${list.id})">X</button>` : ''}
    `;
    block.appendChild(titleRow);

    const table = document.createElement('table');
    table.className = 'list-table';

    if (list.columns.length > 0) {
      const thead = document.createElement('thead');
      let headHtml = '<tr><th class="label-th"></th>';
      list.columns.forEach((col, ci) => {
        headHtml += `<th>${esc(col)}${globalEditing ? `<button class="col-del-btn" onclick="removeColumn(${list.id},${ci})">X</button>` : ''}</th>`;
      });
      if (globalEditing) headHtml += '<th></th>';
      headHtml += '</tr>';
      thead.innerHTML = headHtml;
      table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    list.items.forEach(item => {
      const tr = document.createElement('tr');
      const labelTd = document.createElement('td');
      labelTd.className = 'label-td';
      labelTd.appendChild(buildLabelCell(item));
      tr.appendChild(labelTd);

      list.columns.forEach((_, ci) => {
        const td = document.createElement('td');
        const dotVal = item.dots[ci] != null ? item.dots[ci] : 0;
        const isBlend = typeof dotVal === 'object' && dotVal !== null;

        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'dots';

        legend.forEach((leg, li) => {
          const dot = document.createElement('div');
          dot.className = 'dot';
          dot.title = leg.name;
          dot.style.background = leg.color;

          if (isBlend && (dotVal.a === li || dotVal.b === li)) {
            dot.classList.add('blended');
          } else if (!isBlend && dotVal === li) {
            dot.classList.add('selected');
          }

          attachDotInteraction(dot, list.id, item.id, ci, li, dotsDiv);

          dotsDiv.appendChild(dot);
        });

        if (isBlend) {
          dotsDiv.dataset.blendA = dotVal.a;
          dotsDiv.dataset.blendB = dotVal.b;
        }
        td.appendChild(dotsDiv);
        tr.appendChild(td);
      });

      if (globalEditing) {
        const tdDel = document.createElement('td');
        tdDel.innerHTML = `<button class="delete-btn" onclick="removeItem(${list.id},${item.id})">X</button>`;
        tr.appendChild(tdDel);
      }
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    block.appendChild(table);

    if (globalEditing) {
      const actions = document.createElement('div');
      actions.className = 'edit-actions';

      const itemRow = document.createElement('div');
      itemRow.className = 'inline-add-row';
      const itemInp = document.createElement('input');
      itemInp.type = 'text';
      itemInp.id = `add-item-input-${list.id}`;
      itemInp.placeholder = 'New item...';
      itemInp.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(list.id); });
      const itemBtn = document.createElement('button');
      itemBtn.textContent = '+ item';
      itemBtn.onclick = () => addItem(list.id);
      itemRow.appendChild(itemInp);
      itemRow.appendChild(itemBtn);

      const colRow = document.createElement('div');
      colRow.className = 'inline-add-row';
      const colInp = document.createElement('input');
      colInp.type = 'text';
      colInp.id = `add-col-input-${list.id}`;
      colInp.placeholder = 'New column...';
      colInp.addEventListener('keydown', e => { if (e.key === 'Enter') addColumn(list.id); });
      const colBtn = document.createElement('button');
      colBtn.textContent = '+ column';
      colBtn.onclick = () => addColumn(list.id);
      colRow.appendChild(colInp);
      colRow.appendChild(colBtn);

      actions.appendChild(itemRow);
      actions.appendChild(colRow);
      block.appendChild(actions);
    }

    grid.appendChild(block);
  });

  const blendDivs = document.querySelectorAll('.dots[data-blend-a]');
  blendDivs.forEach(div => {
    drawBlendArc(div, parseInt(div.dataset.blendA), parseInt(div.dataset.blendB));
  });
}

function drawBlendArc(dotsDiv, idxA, idxB) {
  dotsDiv.classList.remove('blend-pill');

  const DOT = 20;
  const GAP = 5;

  const leftPx    = idxA * (DOT + GAP);
  const rightEdge = idxB * (DOT + GAP) + DOT;
  const widthPx   = rightEdge - leftPx;

  const colorA = legend[idxA] ? legend[idxA].color : '#888';
  const colorB = legend[idxB] ? legend[idxB].color : '#888';

  dotsDiv.style.setProperty('--pill-left',   leftPx  + 'px');
  dotsDiv.style.setProperty('--pill-width',  widthPx + 'px');
  dotsDiv.style.setProperty('--blend-col-a', colorA);
  dotsDiv.style.setProperty('--blend-col-b', colorB);
  dotsDiv.classList.add('blend-pill');
}

function attachDotInteraction(dot, lid, iid, ci, li, dotsDiv) {
  let pressTimer = null;
  let blendMode = false;
  let blendCommitted = false;
  let originLi = li;
  let currentBlendTarget = li;

  function startBlendDrag(e) {
    e.preventDefault();
    blendMode = true;
    originLi = li;
    currentBlendTarget = li;
    dotsDiv.classList.add('dragging-blend');
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  }

  function getClientX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
  }

  function getOrCreatePreviewPill() {
    let pill = dotsDiv.querySelector('.blend-preview-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'blend-preview-pill';
      dotsDiv.style.position = 'relative';
      dotsDiv.insertBefore(pill, dotsDiv.firstChild);
    }
    return pill;
  }

  function removePreviewPill() {
    const pill = dotsDiv.querySelector('.blend-preview-pill');
    if (pill) pill.remove();
  }

  function updatePreviewPill(idxA, idxB) {
    const DOT = 20;
    const GAP = 5;
    const a = Math.min(idxA, idxB);
    const b = Math.max(idxA, idxB);
    const leftPx  = a * (DOT + GAP);
    const rightPx = b * (DOT + GAP) + DOT;
    const colA = legend[a] ? legend[a].color : '#888';
    const colB = legend[b] ? legend[b].color : '#888';
    const pill = getOrCreatePreviewPill();
    pill.style.left       = leftPx + 'px';
    pill.style.width      = (rightPx - leftPx) + 'px';
    pill.style.background = `linear-gradient(to right, ${colA}, ${colB})`;
  }

  function onDragMove(e) {
    if (!blendMode) return;
    const clientX = getClientX(e);
    const allDots = Array.from(dotsDiv.querySelectorAll('.dot'));
    allDots.forEach(d => d.classList.remove('blend-candidate'));

    let hovered = null;
    allDots.forEach((d, idx) => {
      const rect = d.getBoundingClientRect();
      if (clientX >= rect.left - 4 && clientX <= rect.right + 4) {
        hovered = idx;
      }
    });

    if (hovered !== null && hovered !== originLi) {
      currentBlendTarget = hovered;
      const a = Math.min(originLi, currentBlendTarget);
      const b = Math.max(originLi, currentBlendTarget);
      if (allDots[a]) allDots[a].classList.add('blend-candidate');
      if (b !== a && allDots[b]) allDots[b].classList.add('blend-candidate');
      updatePreviewPill(originLi, currentBlendTarget);
    } else {
      currentBlendTarget = originLi;
      removePreviewPill();
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    onDragMove(e);
  }

  function onDragEnd(e) {
    if (!blendMode) return;
    blendMode = false;
    removePreviewPill();
    dotsDiv.classList.remove('dragging-blend');
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onDragEnd);

    if (currentBlendTarget !== originLi) {
      blendCommitted = true;
      setDotBlend(lid, iid, ci, originLi, currentBlendTarget);
    }
  }

  dot.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    pressTimer = setTimeout(() => { startBlendDrag(e); }, 300);
    document.addEventListener('mouseup', function cancelHold() {
      clearTimeout(pressTimer);
      document.removeEventListener('mouseup', cancelHold);
    }, { once: true });
  });

  dot.addEventListener('touchstart', e => {
    pressTimer = setTimeout(() => { startBlendDrag(e); }, 300);
  }, { passive: true });

  dot.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
  });

  dot.addEventListener('click', e => {
    if (blendCommitted) { blendCommitted = false; return; }
    if (!blendMode) {
      cycleDot(lid, iid, ci, li);
    }
  });
}

function render() {
  const btn = document.getElementById('global-edit-btn');
  if (btn) {
    btn.textContent = globalEditing ? 'Done editing' : 'Edit \u270E';
    btn.classList.toggle('active', globalEditing);
  }
  const addListControls = document.getElementById('add-list-controls');
  if (addListControls) {
    addListControls.style.display = globalEditing ? 'flex' : 'none';
  }
  renderLegend();
  renderLists();
  if (openColorPicker !== null) positionColorPicker();
}

document.addEventListener('click', e => {
  if (
    openColorPicker !== null &&
    !e.target.closest('#color-picker-portal') &&
    !e.target.classList.contains('pill-color-btn')
  ) {
    openColorPicker = null;
    openColorPickerPos = null;
    render();
  }
  if (dropdownOpen && !e.target.closest('#custom-dropdown')) {
    closeCustomDropdown();
  }
  if (importDropdownOpen && !e.target.closest('#import-json-wrapper')) {
    closeImportDropdown();
  }
});

window.addEventListener('scroll', () => { positionColorPicker(); }, true);
window.addEventListener('resize', () => { positionColorPicker(); });

function toggleDark() {
  darkMode = !darkMode;
  document.body.classList.toggle('dark', darkMode);
  document.getElementById('darkmode-btn').textContent = darkMode ? 'Light' : 'Dark';
  try { localStorage.setItem('darkMode', darkMode ? '1' : '0'); } catch (e) {}
}

function restoreDarkMode() {
  try {
    if (localStorage.getItem('darkMode') === '1') {
      darkMode = true;
      document.body.classList.add('dark');
      const btn = document.getElementById('darkmode-btn');
      if (btn) btn.textContent = 'Light';
    }
  } catch (e) {}
}


function exportJson() {
  const data = {
    legend: legend.map(l => ({ name: l.name, color: l.color })),
    lists: lists.map(l => ({
      name: l.name,
      columns: l.columns,
      items: l.items.map(i => ({
        label: i.label,
        desc:  i.desc || undefined,
        dots:  i.dots,
      }))
    }))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const now      = new Date();
  const hh       = String(now.getHours()).padStart(2, '0');
  const dd       = String(now.getDate()).padStart(2, '0');
  const mm       = String(now.getMonth() + 1).padStart(2, '0');
  const yy       = now.getFullYear();
  const link = document.createElement('a');
  link.download = `spicy_list_${hh}_${dd}_${mm}_${yy}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

function initDropImport() {
  const app = document.getElementById('app');

  app.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    app.classList.add('drop-target');
  });

  app.addEventListener('dragleave', e => {
    if (e.relatedTarget && app.contains(e.relatedTarget)) return;
    app.classList.remove('drop-target');
  });

  app.addEventListener('drop', async e => {
    app.classList.remove('drop-target');
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) {
      try {
        const data = JSON.parse(await file.text());
        applyPresetData(data, 'add');
      } catch (err) {
        showPresetPopover(`Could not read ${file.name}`);
      }
    }
  });
}


let importDropdownOpen = false;

function toggleImportDropdown() {
  importDropdownOpen = !importDropdownOpen;
  const dd = document.getElementById('import-dropdown');
  if (dd) dd.style.display = importDropdownOpen ? 'block' : 'none';
}

function closeImportDropdown() {
  importDropdownOpen = false;
  const dd = document.getElementById('import-dropdown');
  if (dd) dd.style.display = 'none';
}

function triggerImportJson(mode) {
  closeImportDropdown();
  const input = document.getElementById('import-json-input');
  if (!input) return;
  input.onchange = async () => {
    const files = Array.from(input.files).filter(f => f.name.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(await file.text());
        applyPresetData(data, mode);
      } catch (err) {
        showPresetPopover(`Could not read ${file.name}`);
      }
    }
    input.value = '';
  };
  input.click();
}

async function exportJpg() {
  const cs = getComputedStyle(document.body);
  const t = {
    bg:        cs.getPropertyValue('--bg').trim(),
    bgCard:    cs.getPropertyValue('--bg-card').trim(),
    bgLegend:  cs.getPropertyValue('--bg-legend').trim(),
    border:    cs.getPropertyValue('--border').trim(),
    text:      cs.getPropertyValue('--text').trim(),
    textMuted: cs.getPropertyValue('--text-muted').trim(),
    borderRow: cs.getPropertyValue('--border-row').trim(),
    borderHead:cs.getPropertyValue('--border-head').trim(),
    textFaint: cs.getPropertyValue('--text-faint').trim(),
  };

  const appW = document.getElementById('app').getBoundingClientRect().width;

  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    `background:${t.bg}`, 'padding:20px',
    `width:${appW}px`,
    'box-sizing:border-box',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    `color:${t.text}`,
  ].join(';');

  const legendWrap = document.createElement('div');
  legendWrap.style.cssText = [
    `background:${t.bgLegend}`, `border:0.5px solid ${t.border}`, 'border-radius:12px',
    'padding:10px 14px', 'margin-bottom:16px', 'display:flex',
    'align-items:center', 'gap:10px', 'flex-wrap:wrap',
  ].join(';');

  const legendLabel = document.createElement('span');
  legendLabel.textContent = 'Legend';
  legendLabel.style.cssText = `font-size:13px;font-weight:500;color:${t.textMuted};white-space:nowrap;flex-shrink:0;`;
  legendWrap.appendChild(legendLabel);

  const pillsRow = document.createElement('div');
  pillsRow.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;align-items:center;';
  legend.forEach(item => {
    const pill = document.createElement('div');
    pill.style.cssText = [
      'display:flex', 'align-items:center', 'gap:5px',
      'padding:3px 8px 3px 6px', 'border-radius:99px',
      `border:0.5px solid ${t.border}`, `background:${t.bgCard}`,
      `font-size:14px`, `color:${t.textMuted}`,
    ].join(';');
    const dot = document.createElement('div');
    dot.style.cssText = `width:16px;height:16px;border-radius:50%;background:${item.color};flex-shrink:0;`;
    const name = document.createElement('span');
    name.textContent = item.name;
    pill.appendChild(dot);
    pill.appendChild(name);
    pillsRow.appendChild(pill);
  });
  legendWrap.appendChild(pillsRow);
  wrap.appendChild(legendWrap);

  const gridClone = document.getElementById('lists-grid').cloneNode(true);
  gridClone.style.cssText = 'display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;width:100%;';
  gridClone.querySelectorAll('.delete-btn,.col-del-btn,.edit-actions').forEach(el => el.remove());

  gridClone.querySelectorAll('.list-block').forEach(b => {
    b.style.background = t.bgCard;
    b.style.border = `0.5px solid ${t.border}`;
  });
  gridClone.querySelectorAll('.list-title-row h2').forEach(h => { h.style.color = t.text; });
  gridClone.querySelectorAll('.list-table thead th').forEach(th => {
    th.style.color = t.textFaint;
    th.style.borderBottom = `0.5px solid ${t.borderHead}`;
  });
  gridClone.querySelectorAll('.list-table tbody tr').forEach(tr => {
    tr.style.borderBottom = `0.5px solid ${t.borderRow}`;
  });
  gridClone.querySelectorAll('.list-table tbody td.label-td').forEach(td => { td.style.color = t.text; });

  //blend-pill pseudo-elements don't survive cloneNode, replace with real divs
  const liveDots  = Array.from(document.getElementById('lists-grid').querySelectorAll('.dots.blend-pill'));
  const cloneDots = Array.from(gridClone.querySelectorAll('.dots.blend-pill'));
  liveDots.forEach((live, i) => {
    const clone = cloneDots[i];
    if (!clone) return;
    const left  = live.style.getPropertyValue('--pill-left');
    const width = live.style.getPropertyValue('--pill-width');
    const colA  = live.style.getPropertyValue('--blend-col-a');
    const colB  = live.style.getPropertyValue('--blend-col-b');
    const pill = document.createElement('div');
    pill.style.cssText = [
      'position:absolute', `left:${left}`, `width:${width}`,
      'top:0', 'bottom:0', 'border-radius:999px', 'pointer-events:none',
      `background:linear-gradient(to right,${colA},${colB})`, 'z-index:0',
    ].join(';');
    clone.style.position = 'relative';
    clone.insertBefore(pill, clone.firstChild);
    clone.querySelectorAll('.dot').forEach(d => {
      d.style.position = 'relative';
      d.style.zIndex = '1';
    });
  });

  wrap.appendChild(gridClone);
  document.body.appendChild(wrap);

  try {
      const blocks   = Array.from(wrap.querySelectorAll('.list-block'));
    const wrapRect = wrap.getBoundingClientRect();
    const padding  = 20;
    const contentW = blocks.length > 0
      ? Math.ceil(Math.max(...blocks.map(b => b.getBoundingClientRect().right - wrapRect.left)) + padding)
      : wrap.scrollWidth;
    const contentH = wrap.scrollHeight;

    wrap.style.width  = contentW + 'px';
    wrap.style.height = contentH + 'px';

    const canvas = await html2canvas(wrap, {
      backgroundColor: t.bg,
      scale: 2,
      useCORS: true,
      logging: false,
      width:  contentW,
      height: contentH,
    });

    const now      = new Date();
    const hh       = String(now.getHours()).padStart(2, '0');
    const dd       = String(now.getDate()).padStart(2, '0');
    const mm       = String(now.getMonth() + 1).padStart(2, '0');
    const yy       = now.getFullYear();
    const filename = `spicy_list_${hh}_${dd}_${mm}_${yy}.jpg`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  } finally {
    document.body.removeChild(wrap);
  }
}

(function injectListDragStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .label-cell {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .info-dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--text-muted, #aaa);
      color: var(--bg, #1a1a1a);
      font-size: 9px;
      font-weight: 700;
      font-style: italic;
      cursor: pointer;
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.15s;
      user-select: none;
    }
    .info-dot:hover, .info-dot:focus {
      opacity: 1;
      outline: none;
    }
    #app.drop-target::after {
      content: 'Drop .json to import';
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 500;
      color: var(--text, #eee);
      background: rgba(0,0,0,0.45);
      border: 3px dashed var(--text-muted, #aaa);
      border-radius: 16px;
      z-index: 8000;
      pointer-events: none;
      box-sizing: border-box;
    }
    .import-json-wrapper {
      position: relative;
    }
    .import-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      background: var(--bg-card, #2a2a2a);
      border: 0.5px solid var(--border, #444);
      border-radius: 8px;
      overflow: hidden;
      z-index: 1000;
      min-width: 140px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .import-dropdown-item {
      padding: 9px 14px;
      font-size: 13px;
      color: var(--text, #eee);
      cursor: pointer;
      white-space: nowrap;
    }
    .import-dropdown-item:hover {
      background: var(--bg-legend, #333);
    }
    .edit-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px 6px;
    }
    .inline-add-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .inline-add-row input {
      flex: 1;
      min-width: 0;
      padding: 4px 8px;
      border-radius: 6px;
      border: 0.5px solid var(--border, #444);
      background: var(--bg, #1a1a1a);
      color: var(--text, #eee);
      font-size: 13px;
    }
    .inline-add-row input:focus {
      outline: none;
      border-color: var(--text-muted, #aaa);
    }
    .inline-add-row button {
      white-space: nowrap;
      flex-shrink: 0;
    }
    .blend-preview-pill {
      position: absolute;
      top: 0;
      bottom: 0;
      border-radius: 999px;
      pointer-events: none;
      z-index: 0;
      opacity: 0.55;
      transition: left 0.06s ease, width 0.06s ease;
    }
    .dots .dot {
      position: relative;
      z-index: 1;
    }
    .custom-dropdown-menu {
      max-height: calc(100vh - 80px);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .custom-dropdown-separator {
      height: 2px;
      background: var(--border, #555);
      margin: 2px 0;
    }
    .list-drag-handle {
      cursor: grab;
      font-size: 16px;
      color: var(--text-muted, #aaa);
      padding: 0 4px;
      user-select: none;
      flex-shrink: 0;
      letter-spacing: -2px;
    }
    .list-drag-handle:active { cursor: grabbing; }
    .list-block[draggable="true"] { cursor: default; }
    .list-block.list-dragging {
      opacity: 0.4;
    }
    .list-block.list-drag-over {
      outline: 2px dashed var(--text-muted, #aaa);
      outline-offset: 3px;
    }
  `;
  document.head.appendChild(style);
})();

restoreDarkMode();
render();
initPremade();
initDropImport();
