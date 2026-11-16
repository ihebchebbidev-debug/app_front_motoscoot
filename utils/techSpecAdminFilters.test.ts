import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FILTERS, sanitizeFilters, loadFilters, saveFilters, updateFilters,
  activeFilterCount, toQuery, isIncomplete, PAGE_SIZE,
} from './techSpecAdminFilters.ts';

test('default list: newest first, page 1, nothing filtered', () => {
  assert.equal(DEFAULT_FILTERS.sort, 'recent');
  assert.deepEqual(toQuery(DEFAULT_FILTERS), {
    page: 1, limit: PAGE_SIZE, sort: 'recent',
    status: undefined, search: undefined, brand: undefined, category: undefined, tunisia: undefined,
  });
  assert.equal(activeFilterCount(DEFAULT_FILTERS), 0);
});

test('changing a filter or the sort goes back to page 1; changing page does not', () => {
  const p3 = { ...DEFAULT_FILTERS, page: 3 };
  assert.equal(updateFilters(p3, { brand: 'SYM' }).page, 1);
  assert.equal(updateFilters(p3, { sort: 'views' }).page, 1);
  assert.equal(updateFilters(p3, { page: 4 }).page, 4);
});

test('the state survives a visit to a fiche (session storage), and bad storage falls back to defaults', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  const f = { ...DEFAULT_FILTERS, status: 'draft' as const, brand: 'Honda', page: 2 };
  saveFilters(f, storage);
  assert.deepEqual(loadFilters(storage), f);

  store.set('ms_admin_techspecs_filters', '{oops');
  assert.deepEqual(loadFilters(storage), DEFAULT_FILTERS);
  assert.deepEqual(loadFilters({ getItem: () => { throw new Error('blocked'); } }), DEFAULT_FILTERS);
  assert.doesNotThrow(() => saveFilters(f, { setItem: () => { throw new Error('full'); } }));
});

test('unknown values from storage are dropped', () => {
  const f = sanitizeFilters({ status: 'hack', sort: 'DROP TABLE', tunisia: 'maybe', page: -2, brand: 7 });
  assert.deepEqual(f, DEFAULT_FILTERS);
});

test('active filters and empty values in the query', () => {
  const f = { ...DEFAULT_FILTERS, search: '  xmax ', tunisia: 'false' as const };
  assert.equal(activeFilterCount(f), 2);
  assert.equal(toQuery(f).search, 'xmax');
  assert.equal(toQuery({ ...f, search: '   ' }).search, undefined);
});

test('à compléter = no photo, or neither cc nor power', () => {
  assert.equal(isIncomplete({ image: '', engine: { cc: '471 cc' } }), true);
  assert.equal(isIncomplete({ image: '/uploads/a.webp', engine: {} }), true);
  assert.equal(isIncomplete({ image: '/uploads/a.webp', engine: { power: '47,5 ch' } }), false);
});
