import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner, 2026-11-19: « Disponibles en Tunisie » as a switch in the filter bar
// of /fiches-techniques, on computers and phones (it was hidden in « Trier »).

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const page = read('../components/TechSpecsBrands.tsx');
const bar = read('../components/ui/FilterBar.tsx');

test('the brands page has a Tunisia switch, separate from the sort', () => {
  assert.match(page, /const \[inTunisia, setInTunisia\] = useState\(availableInTunisia\);/, '?available_in_tunisia=true opens it on');
  assert.match(page, /id: 'tunisia', label: 'Disponibles en Tunisie', checked: inTunisia, onChange: setInTunisia/);
  assert.match(page, /toggles=\{toggles\}/);
  assert.match(page, /\} = inTunisia \? tunisiaBrandsQuery : allBrandsQuery;/, 'the switch picks the Tunisia list');
  assert.match(page, /\+ \(inTunisia \? 1 : 0\);/, 'counted on the phone « Filtres » button');
  assert.match(page, /setInTunisia\(false\); \}, \[\]\);/, 'reset clears it');
});

test('the shared bar draws switches: in the bar from 768 px, on top of the phone panel', () => {
  assert.match(bar, /\{toggles\.map\(\(t\) => <SwitchRow key=\{t\.id\}/);
  assert.match(bar, /\(extraFilters\.length > 0 \|\| toggles\.length > 0 \|\| sortWithFilters\)/);
  assert.match(bar, /<input type="checkbox" role="switch" checked=\{t\.checked\}/);
  // One switch component for /annonces and this bar.
  assert.match(read('../components/search/MobileFilters.tsx'), /import \{ SwitchRow \} from '\.\.\/ui\/SwitchRow';/);
});
