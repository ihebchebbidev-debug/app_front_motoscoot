export function parseComparisonIds(raw: string | undefined, maxSlots = 2): Array<string | number> {
  const ids = [...new Set((raw || '').split(',').map(id => id.trim()).filter(Boolean))];
  return ids.slice(0, maxSlots).map(id => /^\d+$/.test(id) ? Number(id) : id);
}

export function canSelectComparisonId(slots: Array<string | number | null>, index: number, id: string | number): boolean {
  return Number.isInteger(index) && index >= 0 && index < slots.length &&
    !slots.some((existing, i) => i !== index && existing !== null && String(existing) === String(id));
}