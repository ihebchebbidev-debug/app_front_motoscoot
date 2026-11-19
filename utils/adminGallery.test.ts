import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  galleryItemIds, reorderGallery, moveGalleryItem, galleryPosition, galleryAnnouncements, GALLERY_DND_INSTRUCTIONS,
} from './adminGallery.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const GALLERY = 'components/admin/AdminGalleryUpload.tsx';

test('each image gets a stable, unique id, even when a URL is repeated', () => {
  assert.deepEqual(galleryItemIds(['/a.jpg', '/b.jpg']), ['/a.jpg', '/b.jpg']);
  const ids = galleryItemIds(['/a.jpg', '/b.jpg', '/a.jpg', '/a.jpg']);
  assert.deepEqual(ids, ['/a.jpg', '/b.jpg', '/a.jpg#2', '/a.jpg#3']);
  assert.equal(new Set(ids).size, ids.length);
});

test('dropping an image on another one moves it there, the others keep their order', () => {
  const urls = ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg'];
  assert.deepEqual(reorderGallery(urls, '/4.jpg', '/1.jpg'), ['/4.jpg', '/1.jpg', '/2.jpg', '/3.jpg']);
  assert.deepEqual(reorderGallery(urls, '/1.jpg', '/3.jpg'), ['/2.jpg', '/3.jpg', '/1.jpg', '/4.jpg']);
  assert.deepEqual(urls, ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg'], 'the original list is never changed');
});

test('a drop outside the gallery, on itself or on an unknown id changes nothing', () => {
  const urls = ['/1.jpg', '/2.jpg'];
  assert.deepEqual(reorderGallery(urls, '/1.jpg', null), urls);
  assert.deepEqual(reorderGallery(urls, '/1.jpg', '/1.jpg'), urls);
  assert.deepEqual(reorderGallery(urls, '/x.jpg', '/1.jpg'), urls);
});

test('a repeated URL moves only the copy that was dragged', () => {
  const urls = ['/a.jpg', '/b.jpg', '/a.jpg'];
  assert.deepEqual(reorderGallery(urls, '/a.jpg#2', '/a.jpg'), ['/a.jpg', '/a.jpg', '/b.jpg']);
});

test('the ← → buttons move one place and stop at both ends', () => {
  const urls = ['/1.jpg', '/2.jpg', '/3.jpg'];
  assert.deepEqual(moveGalleryItem(urls, 0, 1), ['/2.jpg', '/1.jpg', '/3.jpg']);
  assert.deepEqual(moveGalleryItem(urls, 2, -1), ['/1.jpg', '/3.jpg', '/2.jpg']);
  assert.deepEqual(moveGalleryItem(urls, 0, -1), urls);
  assert.deepEqual(moveGalleryItem(urls, 2, 1), urls);
});

test('screen readers hear French messages with positions', () => {
  const urls = ['/1.jpg', '/2.jpg', '/3.jpg'];
  assert.equal(galleryPosition(urls, '/3.jpg'), 3);
  const a = galleryAnnouncements(() => urls);
  assert.equal(a.onDragStart({ active: { id: '/3.jpg' } }), 'Image 3 sur 3 saisie.');
  assert.equal(a.onDragOver({ active: { id: '/3.jpg' }, over: { id: '/1.jpg' } }), 'Image 3 au-dessus de la position 1 sur 3.');
  assert.equal(a.onDragEnd({ active: { id: '/3.jpg' }, over: { id: '/1.jpg' } }), 'Image 3 déposée en position 1 sur 3.');
  assert.match(a.onDragEnd({ active: { id: '/3.jpg' }, over: null }), /ordre inchangé/);
  assert.match(a.onDragCancel({ active: { id: '/2.jpg' } }), /annulé.*image 2/i);
  assert.match(GALLERY_DND_INSTRUCTIONS, /Espace.*flèches.*Échap/);
});

test('gallery drag and drop: mouse, touch and keyboard, started only from the grip', () => {
  const s = read(GALLERY);
  assert.match(s, /useSensor\(MouseSensor, \{ activationConstraint: \{ distance: \d+ \} \}\)/);
  assert.match(s, /useSensor\(TouchSensor, \{ activationConstraint: \{ delay: \d+, tolerance: \d+ \} \}\)/);
  assert.match(s, /useSensor\(KeyboardSensor, \{ coordinateGetter: sortableKeyboardCoordinates \}\)/);
  // Listeners sit on the grip button only, so Supprimer / Recadrer stay plain clicks.
  assert.match(s, /ref=\{setActivatorNodeRef\}\s*\{\.\.\.attributes\}\s*\{\.\.\.listeners\}/);
  assert.equal((s.match(/\{\.\.\.listeners\}/g) || []).length, 1);
  assert.match(s, /screenReaderInstructions: \{ draggable: GALLERY_DND_INSTRUCTIONS \}/);
  assert.match(s, /announcements,/);
  assert.match(s, /onChange\(next\)/);
});

test('gallery drag and drop: preview, reduced motion, arrows kept, first image marked', () => {
  const s = read(GALLERY);
  assert.match(s, /<DragOverlay zIndex=\{\d+\} dropAnimation=\{reducedMotion \? null : undefined\}>/);
  assert.match(s, /createPortal\(\s*<DragOverlay/, 'the preview is portalled, so a modal transform cannot shift it');
  assert.match(s, /prefers-reduced-motion: reduce/);
  assert.match(s, /useSortable\(\{ id, transition: reducedMotion \? null : undefined \}\)/);
  assert.match(s, /onClick=\{\(\) => onMove\(-1\)\}/);
  assert.match(s, /onClick=\{\(\) => onMove\(1\)\}/);
  assert.match(s, /aria-live="polite"/);
  assert.match(s, /affichée en premier/);
  // Upload, URL, delete and crop paths are still there.
  for (const re of [/uploadsApi\.single/, /uploadsApi\.multiple/, /const addUrl = /, /const removeAt = /, /onCropped\(/]) {
    assert.match(s, re);
  }
});

test('dnd kit stays out of the public first load: the gallery is only used by the lazy admin', () => {
  const users: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.ts$/.test(e.name) && /AdminGalleryUpload'/.test(read(p))) users.push(p);
    }
  };
  for (const d of ['components', 'pages', 'config', 'hooks', 'context']) {
    try { walk(d); } catch { /* folder may not exist */ }
  }
  assert.ok(users.length > 0);
  for (const u of users) assert.match(u, /^components\/admin\//, `${u} imports the admin gallery`);
  assert.match(read('config/routes.tsx'), /lazy\(\(\) => import\('\.\.\/components\/admin\/SuperAdminDashboard'\)\)/);
});
