import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDepositSession, draftKey, type DraftMedia, type DraftStorage } from './depositSession';
import { emptyDepositValues } from './depositValues';

// The deposit session through its interface, with an in-memory storage and a
// form that behaves like react-hook-form's reset: reset(values) makes `values`
// the new defaults unless keepDefaultValues, and reset() goes back to the
// defaults. That rule is what made « Réinitialiser » bring a draft back.

class MemoryStorage implements DraftStorage {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

class FakeForm {
  defaults: Record<string, unknown> = emptyDepositValues();
  values: Record<string, unknown> = emptyDepositValues();
  reset(values?: Record<string, unknown>, options: { keepDefaultValues?: boolean } = {}) {
    if (!values) { this.values = { ...this.defaults }; return; }
    if (!options.keepDefaultValues) this.defaults = { ...values };
    this.values = { ...values };
  }
}

const KEY = draftKey('42');
const MOTO_DRAFT = {
  step: 3,
  values: { category: 'Moto', brand: 'Yamaha', model: 'MT-07', year: '2019', mileage: '12000', price: '25000' },
  mediaList: [
    { id: 'a', url: 'https://api.example.test/uploads/a.webp', status: 'success' },
    { id: 'b', url: 'blob:http://x/1', status: 'success' },
    { id: 'c', url: 'https://api.example.test/uploads/c.webp', status: 'error' },
  ],
};

function setup(draft: unknown = MOTO_DRAFT) {
  const storage = new MemoryStorage();
  if (draft) storage.setItem(KEY, JSON.stringify(draft));
  const form = new FakeForm();
  const log = { step: 0, media: [] as DraftMedia[], cleared: 0 };
  const session = createDepositSession({
    storage, key: KEY, form,
    setStep: (s) => { log.step = s; },
    setMedia: (m) => { log.media = m; },
    clearMedia: () => { log.cleared++; log.media = []; },
  });
  return { storage, form, log, session };
}

test('restore: the draft comes back on the empty form, at its step, with its uploaded photos only', () => {
  const { form, log, session } = setup();
  assert.equal(session.restore(1), 3);
  assert.equal(log.step, 3);
  assert.equal(form.values.brand, 'Yamaha');
  assert.equal(form.values.shoeSize, ''); // a field the draft lacks starts empty
  assert.deepEqual(log.media.map((m) => m.id), ['a']); // no blob: preview, no failed upload
  assert.equal(form.defaults.brand, ''); // the empty form stays the defaults
});

test('restore: a step asked by the URL wins; no draft, nothing happens', () => {
  const a = setup();
  a.session.restore(2);
  assert.equal(a.log.step, 0);
  const b = setup(null);
  assert.equal(b.session.restore(1), null);
  assert.equal(b.form.values.brand, '');
});

test('restore: a draft of another kind of listing loses the fields that do not belong', () => {
  const { form, session } = setup({ step: 2, values: { category: 'Accessoires', accessoryType: 'Casque', year: '2019', cc: '125' } });
  session.restore(1);
  assert.equal(form.values.year, '');
  assert.equal(form.values.cc, '');
  assert.equal(form.values.accessoryType, 'Casque');
});

test('« Réinitialiser » after a restored draft: nothing comes back', () => {
  const { storage, form, log, session } = setup();
  session.restore(1);
  session.startNew();
  assert.deepEqual(form.values, emptyDepositValues());
  assert.equal(storage.getItem(KEY), null);
  assert.equal(log.cleared, 1);
  assert.equal(log.step, 1);
  // Even a later bare reset() of the form lands on the empty form, not the draft.
  form.reset();
  assert.equal(form.values.brand, '');
});

test('published: the draft is gone and nothing is saved until a new deposit', () => {
  const { storage, session } = setup();
  session.restore(1);
  session.published();
  assert.equal(storage.getItem(KEY), null);
  assert.equal(session.saving, false);
  session.save(5, { brand: 'Yamaha' }, []); // the success screen re-renders
  assert.equal(storage.getItem(KEY), null);
  session.startNew(); // « Déposer une autre annonce »
  session.save(1, { brand: 'SYM' }, []);
  assert.equal(JSON.parse(storage.getItem(KEY)!).values.brand, 'SYM');
});

test('save: no File, an upload in flight saved as failed', () => {
  const { storage, session } = setup(null);
  session.save(1, {}, [{ id: 'u', url: 'blob:x', status: 'uploading', file: { big: true } }]);
  const saved = JSON.parse(storage.getItem(KEY)!);
  assert.deepEqual(saved.mediaList, [{ id: 'u', url: 'blob:x', status: 'error' }]);
});

test('an old unscoped draft moves to the account’s key', () => {
  const storage = new MemoryStorage();
  storage.setItem('motoscoot_deposit_draft', JSON.stringify(MOTO_DRAFT));
  const form = new FakeForm();
  const session = createDepositSession({ storage, key: KEY, form, setStep: () => {}, setMedia: () => {}, clearMedia: () => {} });
  assert.equal(session.restore(1), 3);
  assert.equal(storage.getItem('motoscoot_deposit_draft'), null);
  assert.ok(storage.getItem(KEY));
});

test('a storage that throws (private mode) or a broken draft never breaks the deposit', () => {
  const throwing: DraftStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  const form = new FakeForm();
  const session = createDepositSession({ storage: throwing, key: KEY, form, setStep: () => {}, setMedia: () => {}, clearMedia: () => {} });
  assert.equal(session.restore(1), null);
  session.save(1, {}, []);
  session.startNew();
  session.published();
  const broken = setup('{not json');
  broken.storage.setItem(KEY, '{not json');
  assert.equal(broken.session.restore(1), null);
});
