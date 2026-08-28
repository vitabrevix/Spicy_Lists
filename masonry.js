function _masonrySkyAt(placed, x0, x1) {
  let max = 0;
  for (const p of placed) {
    if (p.x1 > x0 && p.x0 < x1 && p.bottom > max) max = p.bottom;
  }
  return max;
}

function _masonryBestPos(nW, nH, containerW, GAP, placed) {
  const xSet = new Set([0]);
  for (const p of placed) { xSet.add(p.x0); xSet.add(p.x1 + GAP); }
  const cands = [...xSet].filter(x => x >= 0 && x + nW <= containerW);
  if (cands.length === 0) cands.push(0);
  let bx = 0, bt = Infinity;
  for (const cx of cands) {
    const sky = _masonrySkyAt(placed, cx, cx + nW);
    const top = sky === 0 ? 0 : sky + GAP;
    if (top < bt || (top === bt && cx < bx)) { bt = top; bx = cx; }
  }
  return { x: bx, top: bt };
}

// Cache: last known positions keyed by "{containerW}:{lid0},{lid1},...".
// Lets masonryLayout skip the destructive measure/reset phase when block
// count and container width are unchanged (e.g. after a dot click).
let _masonryCache = null;

function masonryLayout() {
  const grid = document.getElementById('lists-grid');
  if (!grid) return;

  const resetBlocks = (blks) => {
    blks.forEach(b => {
      b.style.position = '';
      b.style.left = '';
      b.style.top = '';
      b.style.width = '';
    });
  };

  if (window.innerWidth <= 600) {
    grid.classList.remove('masonry-active');
    grid.style.height = '';
    resetBlocks(Array.from(grid.querySelectorAll('.list-block')));
    _masonryCache = null;
    return;
  }

  const GAP = 16;
  const blocks = Array.from(grid.querySelectorAll('.list-block'));

  // Fast path: renderLists() already re-applied these positions synchronously,
  // so there is nothing left to do. Returning here also avoids the destructive
  // resetBlocks + masonry-active toggle that causes the blink.
  if (_masonryCache && _masonryCache.containerW === grid.offsetWidth) {
    if (masonryKey() === _masonryCache.key) return;
  }
  if (blocks.length === 0) return;

  // Measure natural sizes with no masonry interference
  grid.classList.remove('masonry-active');
  resetBlocks(blocks);
  grid.offsetHeight;

  const containerW = grid.offsetWidth;

  // Clamp blocks that are wider than the container
  blocks.forEach(b => {
    if (b.offsetWidth > containerW) b.style.width = containerW + 'px';
  });
  grid.offsetHeight;

  const naturalW = blocks.map(b => Math.round(b.offsetWidth));
  const naturalH = blocks.map(b => Math.round(b.offsetHeight));

  const blockX   = new Array(blocks.length);
  const blockTop = new Array(blocks.length);
  const placed   = new Array(blocks.length);

  grid.classList.add('masonry-active');

  // Pass 1: greedy initial placement
  for (let i = 0; i < blocks.length; i++) {
    const others = placed.filter((_, j) => j < i);
    const { x, top } = _masonryBestPos(naturalW[i], naturalH[i], containerW, GAP, others);
    blockX[i]   = x;
    blockTop[i] = top;
    placed[i]   = { x0: x, x1: x + naturalW[i], bottom: top + naturalH[i] };
  }

  // Pass 2: global compaction
  // For each block i, try every candidate x. For each candidate, re-place
  // all blocks after i greedily and score by total layout height.
  // Accept x that minimises total height (ties broken leftmost).
  // Repeat until no block moves.
  let improved = true;
  let iters = 0;
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

  // Pass 3: reverse compaction — scan last to first so wide early blocks can shift left
  let improved2 = true;
  let iters2 = 0;
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

  // Pass 4: horizontal centering nudge
  // For each block, find the free space on left and right within its horizontal band.
  // Nudge x so both gaps are equal, capped at GAP. Never moves a block closer than
  // GAP to a neighbour — only spreads it toward available empty space.
  blocks.forEach((_, i) => {
    const p = placed[i];
    // Left bound: container edge or right edge of closest block to the left that overlaps vertically
    let leftBound = 0;
    let rightBound = containerW;
    for (let j = 0; j < blocks.length; j++) {
      if (j === i) continue;
      const q = placed[j];
      // Vertical overlap check
      if (q.bottom <= p.bottom - naturalH[i] || q.x0 >= p.x1 + naturalW[i]) continue;
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
    // Target: equal gaps on both sides, but each capped at GAP
    const targetGap = Math.min(GAP, totalFree / 2);
    const idealX = leftBound + targetGap;
    // Only move if it improves balance — never make one side worse than GAP
    const newX = Math.max(leftBound, Math.min(rightBound - naturalW[i], idealX));
    if (Math.abs(newX - blockX[i]) >= 1) {
      blockX[i] = Math.round(newX);
      placed[i] = { x0: blockX[i], x1: blockX[i] + naturalW[i], bottom: p.bottom };
    }
  });

  // Apply
  blocks.forEach((block, i) => {
    block.style.left = blockX[i] + 'px';
    block.style.top  = blockTop[i] + 'px';
  });

  grid.style.height = Math.max(...placed.map(p => p.bottom)) + 'px';

  // Store for fast-path re-apply on next call (e.g. dot click re-renders).
  // Key must match the format used in renderLists() cache check.
  _masonryCache = {
    containerW: grid.offsetWidth,
    key:        masonryKey(),
    blockX:     blockX.slice(),
    blockTop:   blockTop.slice(),
    gridHeight: Math.max(...placed.map(p => p.bottom)),
  };
}

function scheduleMasonry() {
  if (_masonryRafId) cancelAnimationFrame(_masonryRafId);
  _masonryRafId = requestAnimationFrame(() => {
    _masonryRafId = requestAnimationFrame(masonryLayout);
  });
}

window.addEventListener('resize', scheduleMasonry);
window.addEventListener('load', scheduleMasonry);
document.fonts && document.fonts.ready.then(scheduleMasonry);

if (typeof ResizeObserver !== 'undefined') {
  const _masonryRO = new ResizeObserver(scheduleMasonry);
  const _observeMasonryGrid = () => {
    const grid = document.getElementById('lists-grid');
    if (!grid) return;
    _masonryRO.observe(grid);
    Array.from(grid.querySelectorAll('.list-block')).forEach(b => _masonryRO.observe(b));
  };
  requestAnimationFrame(_observeMasonryGrid);
}
