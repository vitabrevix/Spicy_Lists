// Global state — load this first, before all other files.
// Every other file reads/writes these vars directly (no module system).

// --- ID generator ---
let _nextId = 1;
function id() { return _nextId++; }

// --- Core data ---
let legend = [];
let lists  = [];
let activePresetNames = [];

// --- UI state ---
let globalEditing      = false;
let openColorPicker    = null;  // legend item id currently showing color picker, or null
let openColorPickerPos = null;  // { top, left } of the color picker portal

let darkMode     = false;
let headerPinned = false;

// --- Drag state: legend pills ---
let dragSrc     = null;  // legend item id being dragged

// --- Drag state: list blocks ---
let dragSrcList = null;  // list id being dragged

// --- Dropdown open flags ---
let dropdownOpen       = false;  // premade preset dropdown
let importDropdownOpen = false;  // import-JSON dropdown

// --- File map for local folder mode (file: protocol) ---
// Keys are filenames (e.g. "_Default.json"), values are File objects
const fileMap = {};

// --- Masonry scheduler handle ---
let _masonryRafId = null;

// --- Role-pair column filters ---
// When 2+ lists expose BOTH sides of a role pair (e.g. a "Dom" column and a
// "Sub" column), a selector at the top lets the viewer pick a side; the other
// side's column is then hidden (not deleted) in every list that has the pair.
// Picking "Switch" (or re-picking) reveals the hidden columns again.
//   sideOf(col) -> 'dom' | 'sub' | null
//     'dom' = the dominant/active side, 'sub' = the submissive/passive side.
//     Picking the dom-side option hides the sub-side column, and vice versa.
const ROLE_PAIRS = [
  {
    key: 'domsub',
    options: [
      { val: 'dom',    label: 'Dom' },
      { val: 'switch', label: 'Switch' },
      { val: 'sub',    label: 'Sub' },
    ],
    sideOf(col) {
      const c = ' ' + String(col).toLowerCase() + ' ';
      // \bsub\b deliberately does NOT match "subject" (handled by the hypno pair)
      if (/\bdom\b/.test(c)) return 'dom';
      if (/\bsub\b/.test(c)) return 'sub';
      return null;
    },
  },
  {
    key: 'hypno',
    options: [
      { val: 'dom',    label: 'Hypnotist' },
      { val: 'switch', label: 'Switch' },
      { val: 'sub',    label: 'Subject' },
    ],
    sideOf(col) {
      const c = String(col).toLowerCase();
      if (/hypnotist/.test(c)) return 'dom';
      if (/subject/.test(c))   return 'sub';
      return null;
    },
  },
];

// Current pick per pair key: 'dom' | 'switch' | 'sub'. Absent/'switch' hides nothing.
// Kept even when a pair goes inactive, so selections survive list changes.
let roleSelections = {};

// A list "has" a pair when it exposes at least one column on each side.
function listHasRolePair(list, pair) {
  let dom = false, sub = false;
  for (const col of list.columns) {
    const s = pair.sideOf(col);
    if (s === 'dom') dom = true;
    else if (s === 'sub') sub = true;
  }
  return dom && sub;
}

// Pairs whose selector should show: 2+ lists expose both sides.
function activeRolePairs() {
  return ROLE_PAIRS.filter(pair =>
    lists.reduce((n, l) => n + (listHasRolePair(l, pair) ? 1 : 0), 0) >= 2
  );
}

function _activeRoleKeys() {
  return new Set(activeRolePairs().map(p => p.key));
}

// Column indices to hide for a list, given the set of active pair keys.
function hiddenColumnIndices(list, activeKeys) {
  const hidden = new Set();
  ROLE_PAIRS.forEach(pair => {
    if (!activeKeys.has(pair.key)) return;
    const sel = roleSelections[pair.key];
    if (sel !== 'dom' && sel !== 'sub') return;   // 'switch'/unset hides nothing
    if (!listHasRolePair(list, pair)) return;
    const hideSide = sel === 'dom' ? 'sub' : 'dom';
    list.columns.forEach((col, ci) => {
      if (pair.sideOf(col) === hideSide) hidden.add(ci);
    });
  });
  return hidden;
}

// Masonry cache key. Uses the VISIBLE column count per list so hiding a role
// column (which changes block width) invalidates cached positions.
function masonryKey() {
  const activeKeys = _activeRoleKeys();
  return lists.map(l => {
    const vis = l.columns.length - hiddenColumnIndices(l, activeKeys).size;
    return `${l.id}:${vis}`;
  }).join(',') + '|L' + legend.length + '|E' + globalEditing;
}

// --- Preset color palette ---
// Order matches legend slot cycling in addLegendItem()
const PRESET_COLORS = [
  '#e05252', // red
  '#e07d52', // orange
  '#d4b94a', // yellow
  '#5ba85b', // green
  '#4f8fd4', // blue
  '#7b5ea7', // purple
  '#c45c99', // pink
  '#4db8b8', // teal
  '#a0522d', // brown
  '#888888', // grey
];