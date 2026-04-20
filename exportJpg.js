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

  const MOBILE_EXPORT_MIN_W = 1200;
  const rawAppW = document.getElementById('app').getBoundingClientRect().width;
  const appW = Math.max(rawAppW, MOBILE_EXPORT_MIN_W);

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
  legend.forEach((item, li) => {
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
  gridClone.querySelectorAll('.delete-btn,.col-del-btn,.edit-actions').forEach(el => el.remove());

  // Position:relative container; blocks will be placed absolute by our masonry pass
  gridClone.style.cssText = 'position:relative;width:100%;overflow:hidden;';

  // Override every mobile-affected element with explicit inline styles so the
  // @media (max-width:600px) stylesheet rules (which fire based on viewport
  // width, not element width) cannot affect the off-screen export render.
  gridClone.querySelectorAll('.list-title-row h2').forEach(h => { h.style.color = t.text; });
  gridClone.querySelectorAll('.list-table').forEach(tbl => {
    tbl.style.cssText = 'border-collapse:collapse;width:max-content;display:table;';
  });
  gridClone.querySelectorAll('.list-table thead').forEach(thead => {
    thead.style.display = 'table-header-group';
  });
  gridClone.querySelectorAll('.list-table thead th').forEach(th => {
    th.style.cssText = `display:table-cell;color:${t.textFaint};border-bottom:0.5px solid ${t.borderHead};font-size:11px;font-weight:500;text-align:center;padding:0 10px 4px;white-space:nowrap;`;
  });
  gridClone.querySelectorAll('.list-table thead th.label-th').forEach(th => {
    th.style.textAlign = 'left';
    th.style.minWidth = '80px';
  });
  gridClone.querySelectorAll('.list-table tbody tr').forEach(tr => {
    tr.style.cssText = `display:table-row;border-bottom:0.5px solid ${t.borderRow};`;
  });
  gridClone.querySelectorAll('.list-table tbody tr:last-child').forEach(tr => {
    tr.style.borderBottom = 'none';
  });
  gridClone.querySelectorAll('.list-table tbody td').forEach(td => {
    td.style.cssText = 'display:table-cell;padding:5px 10px;vertical-align:middle;white-space:nowrap;';
  });
  gridClone.querySelectorAll('.list-table tbody td.label-td').forEach(td => {
    td.style.cssText = `display:table-cell;padding:5px 12px 5px 10px;vertical-align:middle;white-space:nowrap;font-size:14px;color:${t.text};`;
  });
  // Remove data-col attr so mobile ::before pseudo doesn't inject column labels
  gridClone.querySelectorAll('[data-col]').forEach(el => el.removeAttribute('data-col'));

  // Replace each .dots cell with only the selected dot(s) — single or blend pair
  const DOT_SIZE = 20;
  gridClone.querySelectorAll('.dots').forEach(dotsDiv => {
    const isBlend = dotsDiv.classList.contains('blend-pill');

    if (isBlend) {
      const colA = dotsDiv.style.getPropertyValue('--blend-col-a');
      const colB = dotsDiv.style.getPropertyValue('--blend-col-b');
      const blendA = parseInt(dotsDiv.dataset.blendA, 10);
      const blendB = parseInt(dotsDiv.dataset.blendB, 10);
      const legA = legend[Math.min(blendA, blendB)];
      const legB = legend[Math.max(blendA, blendB)];

      dotsDiv.innerHTML = '';
      dotsDiv.style.cssText = 'position:relative;display:inline-flex;align-items:center;gap:5px;';
      dotsDiv.classList.remove('blend-pill');

      const gradPill = document.createElement('div');
      gradPill.style.cssText = [
        'position:absolute', 'top:0', 'bottom:0', 'left:0', 'right:0',
        'border-radius:999px', 'pointer-events:none', 'z-index:0',
        `background:linear-gradient(to right,${colA || legA.color},${colB || legB.color})`,
      ].join(';');
      dotsDiv.appendChild(gradPill);

      [legA, legB].forEach(leg => {
        if (!leg) return;
        const d = document.createElement('div');
        d.style.cssText = [
          `width:${DOT_SIZE}px`, `height:${DOT_SIZE}px`, 'border-radius:50%',
          `background:${leg.color}`, 'position:relative', 'z-index:1',
        ].join(';');
        dotsDiv.appendChild(d);
      });
    } else {
      const selectedDot = dotsDiv.querySelector('.dot.selected');
      const color = selectedDot ? selectedDot.style.background : (legend[0] ? legend[0].color : '#888');
      const title = selectedDot ? selectedDot.title : '';

      dotsDiv.innerHTML = '';
      dotsDiv.style.cssText = 'display:inline-flex;align-items:center;';

      const d = document.createElement('div');
      d.title = title;
      d.style.cssText = [
        `width:${DOT_SIZE}px`, `height:${DOT_SIZE}px`, 'border-radius:50%',
        `background:${color}`,
      ].join(';');
      dotsDiv.appendChild(d);
    }
  });

  wrap.appendChild(gridClone);
  document.body.appendChild(wrap);

  try {
    const GAP    = 16;
    const PAD    = 20; // wrap padding on each side
    const blocks = Array.from(wrap.querySelectorAll('.list-block'));

    // Give each block desktop-style inline sizing so the browser can measure
    // its natural content width before we lock it in with absolute positioning.
    blocks.forEach(b => {
      b.style.cssText = [
        `background:${t.bgCard}`,
        `border:0.5px solid ${t.border}`,
        'border-radius:12px',
        'padding:14px',
        'box-sizing:border-box',
        'display:inline-block',
        'position:static',
        'width:auto',
        'min-width:0',
        'max-width:none',
      ].join(';');
    });

    // Force reflow so getBoundingClientRect returns content-sized values
    wrap.offsetHeight;

    const containerW = appW - PAD * 2;

    // Clamp blocks wider than containerW (same as live masonryLayout)
    blocks.forEach(b => {
      if (b.offsetWidth > containerW) {
        b.style.width = containerW + 'px';
      }
    });
    wrap.offsetHeight;

    const naturalW = blocks.map(b => Math.min(b.offsetWidth, containerW));
    const naturalH = blocks.map(b => b.offsetHeight);

    const blockX   = new Array(blocks.length);
    const blockTop = new Array(blocks.length);
    const placed   = new Array(blocks.length);

    // Pass 1: greedy initial placement
    for (let i = 0; i < blocks.length; i++) {
      const others = placed.filter((_, j) => j < i);
      const { x, top } = _masonryBestPos(naturalW[i], naturalH[i], containerW, GAP, others);
      blockX[i]   = x;
      blockTop[i] = top;
      placed[i]   = { x0: x, x1: x + naturalW[i], bottom: top + naturalH[i] };
    }

    // Pass 2: global compaction — same algorithm as live masonryLayout
    let improved = true, iters = 0;
    while (improved && iters++ < 12) {
      improved = false;
      for (let i = 0; i < blocks.length; i++) {
        const prefix = placed.slice(0, i);
        // Candidates from ALL placed blocks so block i can slot beside later blocks too
        const xSet = new Set([0]);
        for (const p of placed) { if (p) { xSet.add(p.x0); xSet.add(p.x1 + GAP); } }
        const cands = [...xSet].filter(x => x >= 0 && x + naturalW[i] <= containerW);

        let bestMax = Infinity, bestSum = Infinity, bestX = blockX[i], bestTop = blockTop[i];
        for (const cx of cands) {
          const sky = _masonrySkyAt(prefix, cx, cx + naturalW[i]);
          const top = sky === 0 ? 0 : sky + GAP;
          const simPlaced = prefix.slice();
          simPlaced.push({ x0: cx, x1: cx + naturalW[i], bottom: top + naturalH[i] });
          for (let k = i + 1; k < blocks.length; k++) {
            const { x: kx, top: kt } = _masonryBestPos(naturalW[k], naturalH[k], containerW, GAP, simPlaced);
            simPlaced.push({ x0: kx, x1: kx + naturalW[k], bottom: kt + naturalH[k] });
          }
          const maxB = Math.max(...simPlaced.map(p => p.bottom));
          const sumB = simPlaced.reduce((s, p) => s + p.bottom, 0);
          if (maxB < bestMax || (maxB === bestMax && sumB < bestSum) || (maxB === bestMax && sumB === bestSum && cx < bestX)) {
            bestMax = maxB; bestSum = sumB; bestX = cx; bestTop = top;
          }
        }

        if (bestX !== blockX[i] || bestTop !== blockTop[i]) {
          blockX[i]   = bestX;
          blockTop[i] = bestTop;
          placed[i]   = { x0: bestX, x1: bestX + naturalW[i], bottom: bestTop + naturalH[i] };
          for (let k = i + 1; k < blocks.length; k++) {
            const { x, top } = _masonryBestPos(naturalW[k], naturalH[k], containerW, GAP, placed.slice(0, k));
            blockX[k]   = x;
            blockTop[k] = top;
            placed[k]   = { x0: x, x1: x + naturalW[k], bottom: top + naturalH[k] };
          }
          improved = true;
        }
      }
    }

    // Pass 3: reverse compaction — same as live layout
    let improved2 = true, iters2 = 0;
    while (improved2 && iters2++ < 6) {
      improved2 = false;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const prefix = placed.slice(0, i);
        const xSet = new Set([0]);
        for (const p of placed) { if (p) { xSet.add(p.x0); xSet.add(p.x1 + GAP); } }
        const cands = [...xSet].filter(x => x >= 0 && x + naturalW[i] <= containerW);

        let bestMax = Infinity, bestSum = Infinity, bestX = blockX[i], bestTop = blockTop[i];
        for (const cx of cands) {
          const sky = _masonrySkyAt(prefix, cx, cx + naturalW[i]);
          const top = sky === 0 ? 0 : sky + GAP;
          const simPlaced = prefix.slice();
          simPlaced.push({ x0: cx, x1: cx + naturalW[i], bottom: top + naturalH[i] });
          for (let k = i + 1; k < blocks.length; k++) {
            const { x: kx, top: kt } = _masonryBestPos(naturalW[k], naturalH[k], containerW, GAP, simPlaced);
            simPlaced.push({ x0: kx, x1: kx + naturalW[k], bottom: kt + naturalH[k] });
          }
          const maxB = Math.max(...simPlaced.map(p => p.bottom));
          const sumB = simPlaced.reduce((s, p) => s + p.bottom, 0);
          if (maxB < bestMax || (maxB === bestMax && sumB < bestSum) || (maxB === bestMax && sumB === bestSum && cx < bestX)) {
            bestMax = maxB; bestSum = sumB; bestX = cx; bestTop = top;
          }
        }

        if (bestX !== blockX[i] || bestTop !== blockTop[i]) {
          blockX[i]   = bestX;
          blockTop[i] = bestTop;
          placed[i]   = { x0: bestX, x1: bestX + naturalW[i], bottom: bestTop + naturalH[i] };
          for (let k = i + 1; k < blocks.length; k++) {
            const { x, top } = _masonryBestPos(naturalW[k], naturalH[k], containerW, GAP, placed.slice(0, k));
            blockX[k]   = x;
            blockTop[k] = top;
            placed[k]   = { x0: x, x1: x + naturalW[k], bottom: top + naturalH[k] };
          }
          improved2 = true;
        }
      }
    }

    // Pass 4: horizontal centering nudge (same as live layout)
    blocks.forEach((_, i) => {
      const p = placed[i];
      let leftBound = 0;
      let rightBound = containerW;
      for (let j = 0; j < blocks.length; j++) {
        if (j === i) continue;
        const q = placed[j];
        const topI = p.bottom - naturalH[i];
        const topJ = q.bottom - naturalH[j];
        if (q.bottom <= topI || topJ >= p.bottom) continue;
        if (q.x1 <= p.x0 && q.x1 > leftBound)  leftBound  = q.x1;
        if (q.x0 >= p.x1 && q.x0 < rightBound) rightBound = q.x0;
      }
      const gapLeft  = p.x0 - leftBound;
      const gapRight = rightBound - p.x1;
      const totalFree = gapLeft + gapRight;
      if (totalFree <= 0) return;
      const targetGap = Math.min(GAP, totalFree / 2);
      const idealX = leftBound + targetGap;
      const newX = Math.max(leftBound, Math.min(rightBound - naturalW[i], idealX));
      if (Math.abs(newX - blockX[i]) >= 1) {
        blockX[i] = Math.round(newX);
        placed[i] = { x0: blockX[i], x1: blockX[i] + naturalW[i], bottom: p.bottom };
      }
    });

    // Apply — inline styles immune to media queries
    blocks.forEach((b, i) => {
      b.style.position  = 'absolute';
      b.style.left      = blockX[i] + 'px';
      b.style.top       = blockTop[i] + 'px';
      b.style.width     = naturalW[i] + 'px';
      b.style.maxWidth  = naturalW[i] + 'px';
      b.style.overflow  = 'hidden';
      b.style.boxSizing = 'border-box';
    });

    const gridH = placed.length > 0 ? Math.max(...placed.map(p => p.bottom)) : 0;
    gridClone.style.height = gridH + 'px';

    const contentW = blocks.length > 0
      ? Math.ceil(Math.max(...placed.map(p => p.x1)) + PAD * 2)
      : appW;
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
