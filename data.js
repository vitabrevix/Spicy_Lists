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

function applyPresetData(data, mode, presetName) {
  const parsed = parseLists(data);
  if (mode === 'replace') {
    lists = parsed;
    const parsedLegend = parseLegend(data);
    if (parsedLegend) legend = parsedLegend;
    activePresetNames = presetName ? [presetName] : [];
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
    lists = lists.concat(toAdd);
    if (presetName && !activePresetNames.includes(presetName)) {
      activePresetNames.push(presetName);
    }
  }
  render();
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
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const dd  = String(now.getDate()).padStart(2, '0');
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const yy  = now.getFullYear();
  const link = document.createElement('a');
  link.download = `spicy_list_${hh}_${dd}_${mm}_${yy}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}
