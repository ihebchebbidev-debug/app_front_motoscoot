/**
 * Acceptance rules for the Tiptap admin editor: opening an existing article
 * and saving it again must not change what visitors (and Google) see.
 *
 * Each fixture reproduces a pattern found in the published articles and tips
 * (Nov 2026 check of all 14 published contents). The test loads the exact
 * schema the editor uses (components/admin/richTextExtensions.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { generateHTML, generateJSON } from '@tiptap/html';
import { richTextExtensions } from '../components/admin/richTextExtensions';
import { youtubeEmbedHtml } from './richHtml';

const ext = richTextExtensions();
const roundTrip = (html: string) => generateHTML(generateJSON(html, ext), ext);

const win = new Window();
const dom = (html: string) => {
  const el = win.document.createElement('div');
  el.innerHTML = html;
  return el;
};
const text = (html: string) => (dom(html).textContent || '').replace(/\s+/g, ' ').trim();
const count = (html: string, selector: string) => dom(html).querySelectorAll(selector).length;
/** Same declarations, whatever the spacing / `0` vs `0px` / trailing `;`. */
const css = (style: string | null | undefined) =>
  (style || '').split(';').map((d) => d.replace(/\b0px\b/g, '0').replace(/\s+/g, '')).filter(Boolean).join(';');

test('YouTube blocks come back in our own div.youtube-embed format', () => {
  const html = `<p>Avant</p>${youtubeEmbedHtml('dQw4w9WgXcQ')}<p>Après</p>`;
  const out = roundTrip(html);
  const iframe = dom(out).querySelector('div.youtube-embed > iframe');
  assert.ok(iframe, 'the wrapper + iframe must survive');
  assert.equal(iframe.getAttribute('src'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(css(dom(out).querySelector('div.youtube-embed')?.getAttribute('style')), css(dom(html).querySelector('div.youtube-embed')?.getAttribute('style')));
  assert.equal(count(out, 'iframe'), 1);
});

test('links keep their own target/rel and never gain nofollow', () => {
  const html =
    '<p><a href="https://www.moto-scoot.tn/fiche-technique/sym-adx-300">interne</a> ' +
    '<a href="/annonces" target="_blank" rel="noopener noreferrer">relatif</a> ' +
    '<a href="https://www.yamaha-motor.eu" target="_blank" rel="noopener noreferrer nofollow">externe</a></p>';
  const out = dom(roundTrip(html));
  const [internal, relative, external] = [...out.querySelectorAll('a')];
  assert.equal(internal.getAttribute('href'), 'https://www.moto-scoot.tn/fiche-technique/sym-adx-300');
  assert.equal(internal.getAttribute('rel'), null, 'no rel added to an internal link');
  assert.equal(internal.getAttribute('target'), null);
  assert.equal(relative.getAttribute('href'), '/annonces');
  assert.equal(relative.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(external.getAttribute('rel'), 'noopener noreferrer nofollow');
  assert.equal(out.querySelectorAll('a[rel*=nofollow]').length, 1);
});

test('inline colours, margins and classes on blocks are kept', () => {
  const html =
    '<h2 style="margin: 0px 0px 1em; color: rgb(22, 26, 34)">Titre</h2>' +
    '<p style="color: rgb(0, 0, 0)">Paragraphe <span style="color: rgb(220, 38, 38)">rouge</span> ' +
    '<span style="background-color: rgb(254, 240, 138)">surligné</span> ' +
    '<strong style="color: rgb(15, 23, 42)">gras</strong> <a href="/x" style="color: rgb(230, 84, 0)">lien</a></p>' +
    '<ul class="list-disc pl-6 mb-6 text-gray-700 space-y-2" style="color: rgb(0, 0, 0)"><li>a</li></ul>' +
    '<h3 class="text-2xl font-bold text-gray-900 mb-4">Sous-titre</h3>';
  const out = dom(roundTrip(html));
  assert.equal(css(out.querySelector('h2')?.getAttribute('style')), css('margin: 0px 0px 1em; color: rgb(22, 26, 34)'));
  assert.equal(css(out.querySelector('p')?.getAttribute('style')), css('color: rgb(0, 0, 0)'));
  assert.ok(out.querySelector('span[style*="color: rgb(220, 38, 38)"]'));
  assert.ok(out.querySelector('span[style*="background-color: rgb(254, 240, 138)"]'));
  assert.equal(css(out.querySelector('strong')?.getAttribute('style')), css('color: rgb(15, 23, 42)'));
  assert.equal(css(out.querySelector('a')?.getAttribute('style')), css('color: rgb(230, 84, 0)'));
  assert.equal(out.querySelector('ul')?.getAttribute('class'), 'list-disc pl-6 mb-6 text-gray-700 space-y-2');
  assert.equal(out.querySelector('h3')?.getAttribute('class'), 'text-2xl font-bold text-gray-900 mb-4');
});

test('the orange tip box (div with classes) stays a box with its content', () => {
  const html =
    '<div class="my-8 p-5 bg-orange-50 border border-orange-200 rounded-xl">' +
    '<h4 class="font-bold text-orange-800 mb-2 flex items-center gap-2">Astuce</h4>' +
    '<p class="text-orange-800 text-sm">Graissez à chaud.</p></div>';
  const out = dom(roundTrip(html));
  const box = out.querySelector('div.bg-orange-50');
  assert.ok(box, 'box kept');
  assert.equal(box.getAttribute('class'), 'my-8 p-5 bg-orange-50 border border-orange-200 rounded-xl');
  assert.equal(box.querySelector('h4')?.textContent, 'Astuce');
  assert.equal(box.querySelector('p')?.getAttribute('class'), 'text-orange-800 text-sm');
});

test('alignment survives, including on a text-only <div>', () => {
  const html = '<p style="text-align: center;">centré</p><div style="text-align: right;">droite</div>';
  const out = dom(roundTrip(html));
  const [p1, p2] = [...out.querySelectorAll('p')];
  assert.match(p1.getAttribute('style') || '', /text-align: center/);
  assert.match(p2.getAttribute('style') || '', /text-align: right/);
  assert.equal(p2.textContent, 'droite');
});

test('images stay inline in their paragraph with src and alt', () => {
  const html = '<p><img src="/uploads/photo.webp" alt="Zontes 368G"></p><p>Texte</p>';
  const out = roundTrip(html);
  assert.equal(count(out, 'p > img[src="/uploads/photo.webp"][alt="Zontes 368G"]'), 1);
  assert.equal(count(out, 'p'), 2, 'no extra empty paragraph');
});

test('structure and text are unchanged for a typical article', () => {
  const html =
    '<h2>Fiche technique</h2><p>Le <strong>Yamaha TMAX</strong> est <em>sportif</em>.<br>Deuxième ligne.</p>' +
    '<h3>Points forts</h3><ul><li>Moteur</li><li>Freins</li></ul><ol><li>Un</li></ol>' +
    '<blockquote><p>Citation</p></blockquote><hr><h4>Sources</h4>';
  const out = roundTrip(html);
  assert.equal(text(out), text(html));
  for (const sel of ['h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'blockquote', 'hr']) {
    assert.equal(count(out, sel), count(html, sel), sel);
  }
});

test('a second save changes nothing (stable output)', () => {
  const html =
    `<h2 style="color: rgb(0, 0, 0)">T</h2><p>a <a href="/b" target="_blank" rel="noopener noreferrer">b</a></p>` +
    `${youtubeEmbedHtml('dQw4w9WgXcQ')}<div class="my-8 bg-orange-50"><p>box</p></div><p><img src="/uploads/x.webp"></p>`;
  const once = roundTrip(html);
  assert.equal(roundTrip(once), once);
});

test('public pages import the sanitizer from utils/richHtml, never the editor', () => {
  for (const file of ['components/ArticleDetails.tsx', 'components/TipDetails.tsx']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /from '\.\.\/utils\/richHtml'/, file);
    assert.doesNotMatch(src, /RichTextEditor|richTextExtensions|@tiptap/, file);
  }
  assert.doesNotMatch(readFileSync('utils/richHtml.ts', 'utf8'), /@tiptap/);
});

test('a pasted table keeps its rows, cells, header and merged cells', () => {
  const html =
    '<table border="1" style="width:100%"><thead><tr><th>Modèle</th><th>Prix</th></tr></thead>' +
    '<tbody><tr><td>SYM ADX 300</td><td><strong>24 000</strong> DT</td></tr>' +
    '<tr><td colspan="2">Prix TTC, novembre 2026</td></tr></tbody></table>';
  const out = roundTrip(html);
  assert.equal(count(out, 'table'), 1);
  assert.equal(count(out, 'tr'), 3);
  assert.equal(count(out, 'th'), 2);
  assert.equal(count(out, 'td'), 3);
  assert.equal(count(out, 'td[colspan="2"]'), 1);
  assert.equal(count(out, 'td strong'), 1);
  assert.equal(text(out), text(html));
  assert.equal(roundTrip(out), out, 'stable on a second save');
});

test('accordion, checklist, subscript and superscript survive a save', () => {
  const html =
    '<details open=""><summary>Quelle huile ?</summary><div data-type="detailsContent"><p>10W40.</p></div></details>' +
    '<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Vidange</p></div></li>' +
    '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Chaîne</p></div></li></ul>' +
    '<p>CO<sub>2</sub> et 125 cm<sup>3</sup></p>';
  const out = roundTrip(html);
  assert.equal(count(out, 'details > summary'), 1);
  assert.equal(dom(out).querySelector('summary')?.textContent, 'Quelle huile ?');
  assert.equal(count(out, 'ul[data-type="taskList"] > li[data-checked="true"]'), 1);
  assert.equal(count(out, 'ul[data-type="taskList"] > li[data-checked="false"]'), 1);
  assert.equal(count(out, 'sub'), 1);
  assert.equal(count(out, 'sup'), 1);
  assert.equal(text(out), text(html));
  assert.equal(roundTrip(out), out, 'stable on a second save');
});

test('the public sanitizer allows every tag the new modules write', () => {
  const src = readFileSync('utils/richHtml.ts', 'utf8');
  for (const tag of ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'sub', 'sup', 'label', 'input']) {
    assert.match(src, new RegExp(`'${tag}'`), tag);
  }
  for (const attr of ['colspan', 'rowspan', 'open', 'data-type', 'data-checked']) {
    assert.match(src, new RegExp(`'${attr}'`), attr);
  }
  assert.match(src, /type'\) \|\| ''\)\.toLowerCase\(\) !== 'checkbox'/, 'only checkboxes may survive');
});
