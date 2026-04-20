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