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

function renderRoleSelectors() {
  const bar = document.getElementById('role-bar');
  if (!bar) return;

  const active = activeRolePairs();
  if (active.length === 0) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  let html = '';
  active.forEach(pair => {
    const sel = roleSelections[pair.key] || 'switch';
    html += `<div class="role-selector"><span class="role-selector-label">I am</span><div class="role-seg">`;
    pair.options.forEach(opt => {
      html += `<button type="button" class="role-seg-btn${sel === opt.val ? ' active' : ''}"
        onclick="setRoleSelection('${pair.key}','${opt.val}')">${esc(opt.label)}</button>`;
    });
    html += `</div></div>`;
  });
  bar.innerHTML = html;
}

// Shared desc renderer: {word}[url] = link, [url] = image, plain text = text
function renderDesc(raw) {
  const frag = document.createDocumentFragment();
  const re = /\{([^}]+)\}\[([^\]]+)\]|\[([^\]]+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) {
      frag.appendChild(document.createTextNode(raw.slice(last, m.index)));
    }
    if (m[1] && m[2]) {
      const a = document.createElement('a');
      a.href = m[2];
      a.textContent = m[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.cssText = 'color:var(--text,#eee);text-decoration:underline;pointer-events:auto;';
      frag.appendChild(a);
    } else if (m[3]) {
      const img = document.createElement('img');
      img.src = m[3];
      img.alt = '';
      img.style.cssText = [
        'display:block', 'margin-top:6px',
        'max-width:min(220px,70vw)', 'max-height:min(160px,40vh)',
        'width:auto', 'height:auto',
        'border-radius:6px', 'object-fit:contain',
      ].join(';');
      frag.appendChild(img);
    }
    last = re.lastIndex;
  }
  if (last < raw.length) {
    frag.appendChild(document.createTextNode(raw.slice(last)));
  }
  return frag;
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

    const renderDescLocal = (raw) => {
      //Parses {word}[url] as links and [url] alone as images
      const frag = document.createDocumentFragment();
      // renderDesc is defined at module level above buildLabelCell
      return renderDesc(raw);
    };

    const positionPop = (pop, anchorEl) => {
      pop.style.opacity = '0';
      pop.style.display = 'block';
      const r    = anchorEl.getBoundingClientRect();
      const popW = pop.offsetWidth;
      const popH = pop.offsetHeight;
      let left = r.right + 8;
      if (left + popW > window.innerWidth - 8) left = r.left - popW - 8;
      if (left < 4) left = 4;
      let top = r.top - popH / 2 + r.height / 2;
      if (top < 4) top = 4;
      if (top + popH > window.innerHeight - 4) top = window.innerHeight - popH - 4;
      pop.style.left = left + 'px';
      pop.style.top  = top  + 'px';
      pop.offsetHeight;
      pop.style.opacity = '1';
    };

    //Delay timer shared between this dot and the popover so neither closes it prematurely
    let hideTimer = null;
    const cancelHide = () => { clearTimeout(hideTimer); hideTimer = null; };

    //Fully remove popover from hit-testing when hidden
    const reallyHide = (pop) => {
      pop.style.opacity = '0';
      pop.style.pointerEvents = 'none';
      pop.style.display = 'none';
      pop._pinned = false;
    };

    const scheduleHide = () => {
      //Never auto-hide a click-pinned popover
      const pop = document.getElementById('desc-popover');
      if (pop && pop._pinned) return;
      cancelHide();
      hideTimer = setTimeout(() => {
        const p = document.getElementById('desc-popover');
        if (p && !p._pinned) reallyHide(p);
      }, 120);
    };

    const showPop = (pinned) => {
      cancelHide();
      let pop = document.getElementById('desc-popover');
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 'desc-popover';
        pop.style.cssText = [
          'position:fixed', 'z-index:9999',
          'background:var(--bg-card,#2a2a2a)', 'color:var(--text,#eee)',
          'border:0.5px solid var(--border,#444)', 'border-radius:8px',
          'padding:7px 12px', 'font-size:12px', 'max-width:min(260px,80vw)',
          'white-space:normal', 'line-height:1.5',
          'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
          'pointer-events:auto', 'display:none', 'opacity:0',
          'transition:opacity 0.2s ease',
        ].join(';');
        document.body.appendChild(pop);
      }

      pop._pinned = !!pinned;
      //Re-bind hover so mouse-travel across gap still works for non-pinned
      pop.onmouseenter = () => { if (!pop._pinned) cancelHide(); };
      pop.onmouseleave = () => { if (!pop._pinned) scheduleHide(); };

      pop.innerHTML = '';
      pop.appendChild(renderDescLocal(item.desc));
      pop.style.display = 'block';
      pop.style.pointerEvents = 'auto';
      positionPop(pop, dot);
      pop.querySelectorAll('img').forEach(img => {
        if (!img.complete) img.addEventListener('load', () => positionPop(pop, dot), { once: true });
      });
    };

    const hidePop = () => {
      cancelHide();
      const pop = document.getElementById('desc-popover');
      if (pop) reallyHide(pop);
    };

    dot.addEventListener('mouseenter', () => showPop(false));
    dot.addEventListener('mouseleave', scheduleHide);
    dot.addEventListener('focus', () => showPop(false));
    dot.addEventListener('blur', scheduleHide);
    dot.addEventListener('click', e => {
      e.stopPropagation();
      const pop = document.getElementById('desc-popover');
      //If this dot's popover is already pinned open, close it
      if (pop && pop._pinned && pop.style.display !== 'none') {
        hidePop();
      } else {
        showPop(true);
      }
    });

    wrap.appendChild(dot);
  }

  return wrap;
}

function renderLists() {
  const grid = document.getElementById('lists-grid');
  grid.innerHTML = '';

  const activeKeys = _activeRoleKeys();

  lists.forEach(list => {
    const hidden = hiddenColumnIndices(list, activeKeys);
    const visibleColCount = list.columns.length - hidden.size;

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
    if (visibleColCount > 0) table.classList.add('has-columns');

    if (visibleColCount > 0) {
      const thead = document.createElement('thead');
      let headHtml = '<tr><th class="label-th"></th>';
      list.columns.forEach((col, ci) => {
        if (hidden.has(ci)) return;
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

      list.columns.forEach((col, ci) => {
        if (hidden.has(ci)) return;
        const td = document.createElement('td');
        td.dataset.col = col;
        const dotVal = item.dots[ci] != null ? item.dots[ci] : 0;
        const isBlend = typeof dotVal === 'object' && dotVal !== null;

        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'dots';

        legend.forEach((leg, li) => {
          const dot = document.createElement('div');
          dot.className = 'dot';
          dot.title = leg.name;
          dot.style.background = leg.color;
          //Identity stamps read by the delegated grid listener — survive re-renders
          dot.dataset.lid = list.id;
          dot.dataset.iid = item.id;
          dot.dataset.ci  = ci;
          dot.dataset.li  = li;

          if (isBlend && (dotVal.a === li || dotVal.b === li)) {
            dot.classList.add('blended');
          } else if (!isBlend && dotVal === li) {
            dot.classList.add('selected');
          }

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

  // Re-apply cached masonry positions now that all blocks are in the DOM.
  // Must run after appendChild loop so querySelectorAll finds the blocks.
  // Restoring position+left+top+height synchronously prevents the browser
  // from painting an unstyled frame between innerHTML='' and the rAF layout.
  // Cache key includes column counts and legend size — changes to either
  // alter block dimensions and must trigger a full re-layout.
  if (_masonryCache && window.innerWidth > 600) {
    const blocks = Array.from(grid.querySelectorAll('.list-block'));
    const key = masonryKey();
    if (key === _masonryCache.key && grid.offsetWidth === _masonryCache.containerW) {
      grid.classList.add('masonry-active');
      grid.style.height = _masonryCache.gridHeight + 'px';
      blocks.forEach((b, i) => {
        b.style.position = 'absolute';
        b.style.left     = _masonryCache.blockX[i]  + 'px';
        b.style.top      = _masonryCache.blockTop[i] + 'px';
      });
    }
  }

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
  renderRoleSelectors();
  renderLegend();
  renderLists();
  if (openColorPicker !== null) positionColorPicker();
  applyPinState();
  if (indexOpen) buildIndexPanel();
  scheduleMasonry();
}
