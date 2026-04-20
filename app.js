// Load order matters — each file expects globals from files above it:
//
//   state.js        - globals: legend, lists, id(), activePresetNames, etc.
//   data.js         - parseLists, parseLegend, applyPresetData, exportJson
//   urlEncoding.js  - encodeDotSelections, applyEncodedDots, buildShareUrl, etc.
//   presets.js      - initPremade, showPresetPopover, populateSelect, etc.
//   masonry.js      - _masonryBestPos, _masonrySkyAt, masonryLayout, scheduleMasonry
//   exportJpg.js    - exportJpg
//   dragDots.js     - initDotDelegation, _blendState, setDotBlend, cycleDot
//   render.js       - render, renderLegend, renderLists, buildLabelCell, drawBlendArc
//   ui.js           - all mutations, dark/pin/index, listeners, injected styles
//   app.js          - boot

restoreDarkMode();
restoreHeaderPin();
render();
initPremade();
initDropImport();
initDotDelegation();
