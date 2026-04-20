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
  const popupW = popup.offsetWidth;
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
  const maxIdx = legend.length - 1;
  lists.forEach(l => l.items.forEach(item => {
    item.dots = item.dots.map(d => {
      if (typeof d === 'object' && d !== null) {
        const a = d.a === idx ? -1 : d.a > idx ? d.a - 1 : d.a;
        const b = d.b === idx ? -1 : d.b > idx ? d.b - 1 : d.b;
        if (a < 0 || b < 0 || a === b) return 0;
        return { a: Math.min(a, b), b: Math.max(a, b) };
      }
      if (d === idx) return 0;
      if (d > idx) return Math.min(d - 1, maxIdx);
      return d;
    });
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
  //Track manually created list names in the share URL state
  if (!activePresetNames.includes(name)) {
    activePresetNames.push(name);
  }
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
  if (indexOpen && !e.target.closest('#index-panel') && !e.target.closest('#index-btn')) {
    indexOpen = false;
    const btn = document.getElementById('index-btn');
    if (btn) btn.classList.remove('active');
    removeIndexPanel();
  }
  const pop = document.getElementById('desc-popover');
  if (pop && pop._pinned && !e.target.closest('#desc-popover') && !e.target.closest('.info-dot')) {
    pop.style.opacity = '0';
    pop.style.pointerEvents = 'none';
    pop.style.display = 'none';
    pop._pinned = false;
  }
});

window.addEventListener('scroll', () => {
  positionColorPicker();
  if (headerPinned) {
    const spacer = document.getElementById('pinnable-header-spacer');
    const header = document.getElementById('pinnable-header');
    if (spacer && header) spacer.style.height = header.offsetHeight + 'px';
  }
  updateMobileIndexBtn();
}, true);
window.addEventListener('resize', () => { positionColorPicker(); applyPinState(); });

function toggleDark() {
  darkMode = !darkMode;
  document.body.classList.toggle('dark', darkMode);
  document.getElementById('darkmode-btn').textContent = darkMode ? 'Light' : 'Dark';
  try { localStorage.setItem('darkMode', darkMode ? '1' : '0'); } catch (e) {}
}

let indexOpen = false;

function toggleIndex() {
  indexOpen = !indexOpen;
  const btn = document.getElementById('index-btn');
  if (btn) btn.classList.toggle('active', indexOpen);
  if (indexOpen) {
    buildIndexPanel();
  } else {
    removeIndexPanel();
  }
}

function buildIndexPanel() {
  removeIndexPanel();
  const panel = document.createElement('div');
  panel.id = 'index-panel';
  panel.className = 'index-panel';

  if (lists.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'index-panel-empty';
    empty.textContent = 'No lists yet';
    panel.appendChild(empty);
  } else {
    lists.forEach((list, i) => {
      const item = document.createElement('div');
      item.className = 'index-panel-item';

      const num = document.createElement('span');
      num.className = 'index-panel-item-num';
      num.textContent = (i + 1) + '.';

      const label = document.createElement('span');
      label.textContent = list.name;
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';

      item.appendChild(num);
      item.appendChild(label);

      item.addEventListener('click', () => {
        const block = document.querySelector(`.list-block[data-lid="${list.id}"]`);
        if (block) {
          block.scrollIntoView({ behavior: 'smooth', block: 'start' });
          block.style.outline = '2px solid var(--border-soft)';
          setTimeout(() => { block.style.outline = ''; }, 1200);
        }
        indexOpen = false;
        const btn = document.getElementById('index-btn');
        if (btn) btn.classList.remove('active');
        removeIndexPanel();
      });

      panel.appendChild(item);
    });
  }

  positionIndexPanel(panel);
  document.body.appendChild(panel);
}

function positionIndexPanel(panel) {
  const isMobile = window.innerWidth <= 600;
  const btn = document.getElementById('index-btn');

  if (isMobile) {
    const scrolled = window.scrollY > (document.getElementById('pinnable-header').offsetHeight || 80);
    if (scrolled) {
      panel.classList.add('mobile-float');
      return;
    }
  }

  if (!btn) return;
  const r = btn.getBoundingClientRect();
  panel.style.position = 'fixed';
  panel.style.top = (r.bottom + 6) + 'px';
  const panelW = 200;
  let left = r.right - panelW;
  if (left < 8) left = 8;
  panel.style.left = left + 'px';
  panel.style.right = 'auto';
}

function removeIndexPanel() {
  const p = document.getElementById('index-panel');
  if (p) p.remove();
}

function updateMobileIndexBtn() {
  if (window.innerWidth > 600) return;
  const btn = document.getElementById('index-btn');
  if (!btn) return;
  const header = document.getElementById('pinnable-header');
  const headerH = header ? header.offsetHeight : 80;
  const scrolled = window.scrollY > headerH;
  btn.classList.toggle('mobile-pinned', scrolled);

  const panel = document.getElementById('index-panel');
  if (panel) {
    if (scrolled) {
      panel.classList.add('mobile-float');
      panel.style.position = '';
      panel.style.top = '';
      panel.style.left = '';
    } else {
      panel.classList.remove('mobile-float');
      positionIndexPanel(panel);
    }
  }
}

function applyPinState() {
  const header  = document.getElementById('pinnable-header');
  const spacer  = document.getElementById('pinnable-header-spacer');
  const btn     = document.getElementById('pin-btn');
  if (!header || !spacer) return;
  if (headerPinned) {
    header.classList.add('is-pinned');
    spacer.classList.add('is-pinned');
    spacer.style.height = header.offsetHeight + 'px';
    if (btn) btn.classList.add('active');
  } else {
    header.classList.remove('is-pinned');
    spacer.classList.remove('is-pinned');
    spacer.style.height = '';
    if (btn) btn.classList.remove('active');
  }
}

function togglePin() {
  headerPinned = !headerPinned;
  try { localStorage.setItem('headerPinned', headerPinned ? '1' : '0'); } catch (e) {}
  applyPinState();
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

function restoreHeaderPin() {
  try {
    if (localStorage.getItem('headerPinned') === '1') {
      headerPinned = true;
    }
  } catch (e) {}
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

(function injectStyles() {
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
