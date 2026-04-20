let _blendState = null; //Active blend drag state, null when idle
let _mouseIsDown = false; //True from mousedown until mouseup — blocks re-entry on DOM rebuild after blend commit

function _getOrCreatePreviewPill(dotsDiv) {
  let pill = dotsDiv.querySelector('.blend-preview-pill');
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'blend-preview-pill';
    dotsDiv.style.position = 'relative';
    dotsDiv.insertBefore(pill, dotsDiv.firstChild);
  }
  return pill;
}

function _removePreviewPill(dotsDiv) {
  const pill = dotsDiv.querySelector('.blend-preview-pill');
  if (pill) pill.remove();
}

function _updatePreviewPill(dotsDiv, idxA, idxB) {
  const DOT = 20;
  const GAP = 5;
  const a = Math.min(idxA, idxB);
  const b = Math.max(idxA, idxB);
  const leftPx  = a * (DOT + GAP);
  const rightPx = b * (DOT + GAP) + DOT;
  const colA = legend[a] ? legend[a].color : '#888';
  const colB = legend[b] ? legend[b].color : '#888';
  const pill = _getOrCreatePreviewPill(dotsDiv);
  pill.style.left       = leftPx + 'px';
  pill.style.width      = (rightPx - leftPx) + 'px';
  pill.style.background = `linear-gradient(to right, ${colA}, ${colB})`;
}

function _onBlendMove(e) {
  if (!_blendState) return;
  const { dotsDiv, originLi } = _blendState;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const allDots = Array.from(dotsDiv.querySelectorAll('.dot'));
  allDots.forEach(d => d.classList.remove('blend-candidate'));

  let hovered = null;
  allDots.forEach((d, idx) => {
    const rect = d.getBoundingClientRect();
    if (clientX >= rect.left - 4 && clientX <= rect.right + 4) hovered = idx;
  });

  if (hovered !== null && hovered !== originLi) {
    _blendState.currentTarget = hovered;
    const a = Math.min(originLi, hovered);
    const b = Math.max(originLi, hovered);
    if (allDots[a]) allDots[a].classList.add('blend-candidate');
    if (b !== a && allDots[b]) allDots[b].classList.add('blend-candidate');
    _updatePreviewPill(dotsDiv, originLi, hovered);
  } else {
    _blendState.currentTarget = originLi;
    _removePreviewPill(dotsDiv);
  }
}

function _onBlendTouchMove(e) {
  e.preventDefault();
  _onBlendMove(e);
}

function _onBlendEnd() {
  if (!_blendState) return;
  const { dotsDiv, originLi, currentTarget, lid, iid, ci } = _blendState;
  _blendState = null;

  _removePreviewPill(dotsDiv);
  dotsDiv.classList.remove('dragging-blend');
  document.removeEventListener('mousemove',  _onBlendMove,       true);
  document.removeEventListener('mouseup',    _onBlendEnd,        true);
  document.removeEventListener('touchmove',  _onBlendTouchMove,  true);
  document.removeEventListener('touchend',   _onBlendEnd,        true);

  if (currentTarget !== originLi) {
    setDotBlend(lid, iid, ci, originLi, currentTarget);
  }
  //Reset after render() has finished rebuilding DOM, so re-entrant mousedown on new nodes is blocked
  setTimeout(() => { _mouseIsDown = false; }, 0);
}

function _startBlendDrag(dot) {
  const dotsDiv = dot.closest('.dots');
  if (!dotsDiv) return;
  const li  = parseInt(dot.dataset.li,  10);
  const lid = parseInt(dot.dataset.lid, 10);
  const iid = parseInt(dot.dataset.iid, 10);
  const ci  = parseInt(dot.dataset.ci,  10);

  _blendState = { dotsDiv, originLi: li, currentTarget: li, lid, iid, ci };
  dotsDiv.classList.add('dragging-blend');
  document.addEventListener('mousemove',  _onBlendMove,       true);
  document.addEventListener('mouseup',    _onBlendEnd,        true);
  document.addEventListener('touchmove',  _onBlendTouchMove, { passive: false, capture: true });
  document.addEventListener('touchend',   _onBlendEnd,        true);
}

function initDotDelegation() {
  //Track per-dot hold timers keyed by dataset identity
  const _pressTimers = new Map();
  const _holdFired   = new Map();

  function dotKey(dot) {
    return `${dot.dataset.lid}-${dot.dataset.iid}-${dot.dataset.ci}-${dot.dataset.li}`;
  }

  function isDot(el) {
    return el && el.classList && el.classList.contains('dot') && el.dataset.lid;
  }

  // Mouse
  document.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    //Ignore re-entrant mousedown while button is still physically held (e.g. after render() rebuilds DOM)
    if (_mouseIsDown) return;
    const dot = e.target.closest('.dot');
    if (!isDot(dot)) return;
    //Only handle dots inside the lists-grid
    if (!dot.closest('#lists-grid')) return;
    _mouseIsDown = true;
    const key = dotKey(dot);
    _holdFired.set(key, false);

    const timer = setTimeout(() => {
      _holdFired.set(key, true);
      _startBlendDrag(dot);
    }, 300);
    _pressTimers.set(key, timer);

    function cancelHold() {
      if (!_holdFired.get(key)) {
        clearTimeout(_pressTimers.get(key));
        _mouseIsDown = false; //Quick click — no blend started, reset immediately
      }
      //If hold fired, _onBlendEnd handles cleanup and resets _mouseIsDown
      document.removeEventListener('mouseup', cancelHold, true);
    }
    document.addEventListener('mouseup', cancelHold, true);
  }, true); //capture=true: fires before any element can stop it

  //Suppress native drag on dots
  document.addEventListener('dragstart', e => {
    if (isDot(e.target.closest('.dot'))) e.preventDefault();
  }, true);

  document.addEventListener('click', e => {
    const dot = e.target.closest('.dot');
    if (!isDot(dot)) return;
    if (!dot.closest('#lists-grid')) return;
    const key = dotKey(dot);
    //Swallow the click that fires immediately after a completed blend drag
    if (_holdFired.get(key)) { _holdFired.set(key, false); return; }
    if (!_blendState) {
      const li  = parseInt(dot.dataset.li,  10);
      const lid = parseInt(dot.dataset.lid, 10);
      const iid = parseInt(dot.dataset.iid, 10);
      const ci  = parseInt(dot.dataset.ci,  10);
      cycleDot(lid, iid, ci, li);
    }
  }, true);

  // Touch
  document.addEventListener('touchstart', e => {
    const dot = e.target.closest('.dot');
    if (!isDot(dot)) return;
    if (!dot.closest('#lists-grid')) return;
    const key = dotKey(dot);

    _holdFired.set(key, false);
    const timer = setTimeout(() => {
      _holdFired.set(key, true);
      _startBlendDrag(dot);
    }, 300);
    _pressTimers.set(key, timer);
  }, { passive: true, capture: true });

  document.addEventListener('touchend', e => {
    const dot = e.target.closest('.dot');
    if (!isDot(dot)) return;
    if (!dot.closest('#lists-grid')) return;
    const key = dotKey(dot);
    if (!_holdFired.get(key)) {
      clearTimeout(_pressTimers.get(key));
    }
  }, { capture: true });
}
