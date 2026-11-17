/**
 * RichTextEditor — admin WYSIWYG editor for articles and tips, built on
 * Tiptap (MIT, ProseMirror-based).
 *
 * Contract (unchanged from the previous contentEditable editor):
 *   - input  `value`: the HTML stored in `articles.content` / `tips.content`;
 *   - output `onChange(html)`: sanitized HTML, the same string the public
 *     ArticleDetails / TipDetails pages render through `sanitizeRichHtml`.
 *
 * The schema lives in ./richTextExtensions so the round-trip tests use the
 * exact same rules. Opening an article does NOT rewrite it: onChange only
 * fires when the admin actually edits.
 *
 * Only the admin loads this file (SuperAdminDashboard is lazy-loaded), so
 * visitors never download Tiptap.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { Typography } from '@tiptap/extension-typography';
import { FileHandler } from '@tiptap/extension-file-handler';
import { YouTubeEmbedModal } from './YouTubeEmbedModal';
import { uploadsApi } from '../../services/uploadsApi';
import { richTextExtensions } from './richTextExtensions';
import { sanitizeRichHtml } from '../../utils/richHtml';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Link as LinkIcon, Unlink, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight,
  Palette, Highlighter, Eraser, Undo2, Redo2, Code, Youtube,
  Table as TableIcon, Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  ListChecks, ListCollapse, ImageUp,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const TEXT_COLORS = [
  '#0f172a', '#475569', '#dc2626', '#ea580c', '#d97706',
  '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777',
];
const HIGHLIGHT_COLORS = [
  'transparent', '#fef08a', '#fed7aa', '#fecaca', '#bbf7d0',
  '#bae6fd', '#ddd6fe', '#fbcfe8',
];

/** Same typography as before, so the admin sees the public rendering. */
const EDITOR_CLASS =
  'prose prose-slate max-w-none p-4 focus:outline-none ' +
  'prose-headings:font-black prose-headings:text-slate-900 ' +
  'prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl ' +
  'prose-p:text-slate-700 prose-p:leading-relaxed ' +
  'prose-a:text-primary-600 prose-a:font-bold ' +
  'prose-blockquote:border-l-[3px] prose-blockquote:border-primary-500 ' +
  'prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4 ' +
  'prose-blockquote:rounded-r prose-blockquote:not-italic ' +
  'prose-img:rounded-lg prose-img:my-4 ' +
  'prose-li:my-1';

/**
 * Pasted HTML: drop the inline style/class that Word, Google Docs or a chat
 * tool put on blocks and links (forced black text, margins…), which is how
 * older articles ended up with `color: rgb(0,0,0)` everywhere. Spans keep
 * their style so pasted colours/highlights still work like before.
 */
const STRIP_ON_PASTE = 'p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,div,a,strong,em';
function cleanPastedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll(STRIP_ON_PASTE).forEach((el) => {
    el.removeAttribute('style');
    el.removeAttribute('class');
  });
  return doc.body.innerHTML;
}

const isSafeUrl = (url: string, allowMailto: boolean) =>
  /^https?:\/\//i.test(url) || url.startsWith('/') || (allowMailto && url.startsWith('mailto:'));

const ToolbarBtn: React.FC<{
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    className={`p-1.5 rounded-md transition-colors ${
      active ? 'bg-primary-100 text-primary-700' : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
);

const Divider = () => <span className="w-px h-5 bg-slate-200 mx-0.5" />;

function setLink(editor: Editor) {
  const previous = (editor.getAttributes('link').href as string | undefined) || '';
  const url = window.prompt('URL du lien (https://…)', previous);
  if (url === null) return;
  const href = url.trim();
  if (!href) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  if (!isSafeUrl(href, true)) {
    window.alert('URL invalide. Utilisez http(s):// ou mailto:');
    return;
  }
  // Same behaviour as the previous editor: new links open in a new tab.
  const attrs = { href, target: '_blank', rel: 'noopener noreferrer' };
  if (editor.state.selection.empty && !editor.isActive('link')) {
    editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs }] }).run();
  } else {
    editor.chain().focus().extendMarkRange('link').setLink(attrs).run();
  }
}

function insertImage(editor: Editor) {
  const url = window.prompt('URL de l’image (https://…)');
  if (!url) return;
  const src = url.trim();
  if (!isSafeUrl(src, false)) {
    window.alert('URL invalide.');
    return;
  }
  editor.chain().focus().setImage({ src }).run();
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

/**
 * Upload images through the single /api/uploads pipeline (Multer + Sharp) and
 * insert the returned URLs — never the image bytes — at `pos`.
 */
async function uploadAndInsert(editor: Editor, files: File[], pos?: number) {
  for (const file of files) {
    try {
      const uploaded = await uploadsApi.single(file);
      const node = { type: 'image', attrs: { src: uploaded.url } };
      if (typeof pos === 'number') editor.chain().focus().insertContentAt(pos, node).run();
      else editor.chain().focus().insertContent(node).run();
    } catch {
      window.alert(`Impossible d'envoyer l'image « ${file.name} ».`);
    }
  }
}

/** Table tools, shown only while the cursor is inside a table. */
const TableBar: React.FC<{ editor: Editor }> = ({ editor }) => {
  const btn = (label: string, run: () => boolean, danger = false) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); run(); }}
      className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-white'
      }`}
    >
      {label}
    </button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-slate-200 bg-primary-50/60">
      <span className="text-[11px] font-bold text-slate-500 mr-1">Tableau :</span>
      {btn('+ Ligne dessous', () => c().addRowAfter().run())}
      {btn('+ Colonne à droite', () => c().addColumnAfter().run())}
      {btn('− Ligne', () => c().deleteRow().run())}
      {btn('− Colonne', () => c().deleteColumn().run())}
      {btn('Fusionner / scinder', () => c().mergeOrSplit().run())}
      {btn('Ligne d’en-tête', () => c().toggleHeaderRow().run())}
      {btn('Supprimer le tableau', () => c().deleteTable().run(), true)}
    </div>
  );
};

export const RichTextEditor: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Rédigez votre contenu…',
  minHeight = 280,
}) => {
  const [colorOpen, setColorOpen] = useState(false);
  const [hlOpen, setHlOpen] = useState(false);
  const [ytModalOpen, setYtModalOpen] = useState(false);

  // Latest onChange without re-creating the editor on every parent render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Last HTML we emitted (or loaded) — lets us tell the parent's echo of our
  // own change apart from a real external value (form reset, other article).
  const lastHtmlRef = useRef(value || '');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const extensions = useMemo(
    () => [
      ...richTextExtensions(),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      // French typography while typing: « » quotes, …, —, ©, →. The
      // multiplication rule is off so model names like « 4x4 » stay as typed.
      Typography.configure({
        openDoubleQuote: '«\u00a0',
        closeDoubleQuote: '\u00a0»',
        multiplication: false,
      }),
      // Drop or paste image files → /api/uploads → image URL in the text.
      FileHandler.configure({
        allowedMimeTypes: IMAGE_TYPES,
        onDrop: (ed, files, pos) => { void uploadAndInsert(ed, files, pos); },
        onPaste: (ed, files, htmlContent) => {
          // Pasted HTML that already carries <img> URLs is handled by the editor.
          if (htmlContent) return;
          void uploadAndInsert(ed, files);
        },
      }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value || '',
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: EDITOR_CLASS, style: `min-height:${minHeight}px` },
      transformPastedHTML: cleanPastedHtml,
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : sanitizeRichHtml(ed.getHTML());
      lastHtmlRef.current = html;
      onChangeRef.current(html);
    },
  }, [extensions]);

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming === lastHtmlRef.current) return;
    lastHtmlRef.current = incoming;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  const chain = () => editor.chain().focus();

  return (
    <>
    <div className="rich-editor rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <ToolbarBtn onClick={() => chain().undo().run()} title="Annuler"><Undo2 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().redo().run()} title="Rétablir"><Redo2 size={15} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => chain().setHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Titre 1"><Heading1 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().setHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Titre 2"><Heading2 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().setHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Titre 3"><Heading3 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraphe"><span className="text-[11px] font-bold px-1">P</span></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')} title="Gras"><Bold size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')} title="Italique"><Italic size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleUnderline().run()} active={editor.isActive('underline')} title="Souligné"><UnderlineIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleStrike().run()} active={editor.isActive('strike')} title="Barré"><Strikethrough size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleSubscript().run()} active={editor.isActive('subscript')} title="Indice (CO₂)"><SubscriptIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Exposant (cm³)"><SuperscriptIcon size={15} /></ToolbarBtn>
        <Divider />

        {/* Text color */}
        <div className="relative">
          <ToolbarBtn onClick={() => { setColorOpen((v) => !v); setHlOpen(false); }} title="Couleur du texte">
            <Palette size={15} />
          </ToolbarBtn>
          {colorOpen && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg grid grid-cols-5 gap-1 z-20">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); chain().setColor(c).run(); setColorOpen(false); }}
                  className="w-6 h-6 rounded border border-slate-200"
                  style={{ background: c }}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <ToolbarBtn onClick={() => { setHlOpen((v) => !v); setColorOpen(false); }} title="Surlignage">
            <Highlighter size={15} />
          </ToolbarBtn>
          {hlOpen && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg grid grid-cols-4 gap-1 z-20">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (c === 'transparent') chain().unsetBackgroundColor().run();
                    else chain().setBackgroundColor(c).run();
                    setHlOpen(false);
                  }}
                  className="w-6 h-6 rounded border border-slate-200 relative"
                  style={{ background: c === 'transparent' ? 'white' : c }}
                  aria-label={`Surlignage ${c}`}
                >
                  {c === 'transparent' && <Eraser size={10} className="absolute inset-0 m-auto text-slate-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />
        <ToolbarBtn onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Liste à puces"><List size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Liste numérotée"><ListOrdered size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleTaskList().run()} active={editor.isActive('taskList')} title="Liste de tâches (cases à cocher)"><ListChecks size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citation"><Quote size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Bloc de code"><Code size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={editor.isActive('table')} title="Insérer un tableau"><TableIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().setDetails().run()} active={editor.isActive('details')} title="Accordéon (question / réponse)"><ListCollapse size={15} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => chain().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Aligner à gauche"><AlignLeft size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrer"><AlignCenter size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Aligner à droite"><AlignRight size={15} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => setLink(editor)} active={editor.isActive('link')} title="Insérer un lien"><LinkIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => chain().extendMarkRange('link').unsetLink().run()} title="Retirer le lien"><Unlink size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => insertImage(editor)} title="Insérer une image (URL)"><ImageIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => fileInputRef.current?.click()} title="Importer une image depuis l’ordinateur"><ImageUp size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => setYtModalOpen(true)} title="Insérer une vidéo YouTube"><Youtube size={15} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => chain().unsetAllMarks().clearNodes().unsetTextAlign().run()} title="Effacer le formatage"><Eraser size={15} /></ToolbarBtn>
      </div>

      {editor.isActive('table') && <TableBar editor={editor} />}

      {/* Editing surface — `prose` classes mirror the public page. */}
      <EditorContent editor={editor} />

      <div className="flex justify-end gap-3 px-3 py-1.5 border-t border-slate-100 text-[11px] text-slate-500">
        <span>{editor.storage.characterCount.words().toLocaleString('fr-FR')} mots</span>
        <span>{editor.storage.characterCount.characters().toLocaleString('fr-FR')} caractères</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) void uploadAndInsert(editor, files);
        }}
      />
    </div>
    <YouTubeEmbedModal
      open={ytModalOpen}
      onClose={() => setYtModalOpen(false)}
      onInsert={(videoId) => { editor.chain().focus().setYoutubeVideo(videoId).run(); }}
    />
    </>
  );
};

export default RichTextEditor;
