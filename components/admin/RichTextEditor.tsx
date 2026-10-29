/**
 * RichTextEditor — minimal, dependency-free WYSIWYG editor for admin forms.
 *
 * Why no library (Tiptap / Quill / Lexical):
 *   - keeps the bundle small,
 *   - we already have DOMPurify for sanitization,
 *   - the public `prose` styles do all the visual work — the editor just
 *     needs to PRODUCE clean semantic HTML.
 *
 * Strategy:
 *   - A contentEditable <div> is the source of truth for the user's HTML.
 *   - The toolbar uses `document.execCommand` for formatting (still the
 *     widest-supported API for inline formatting, even though it's marked
 *     "deprecated"). We only call commands that are well-supported across
 *     evergreen browsers (bold, italic, underline, lists, headings, links,
 *     colors, etc.).
 *   - On every input we sanitize with DOMPurify and emit `onChange(html)` —
 *     so the parent form ALWAYS receives sanitized HTML. The same sanitizer
 *     runs on the public ArticleDetails page, guaranteeing the rendered
 *     output is byte-identical to what the editor stored.
 *
 * Output format: HTML string (what the backend already stores in
 * `articles.content` and what ArticleDetails renders via prose-styled
 * `dangerouslySetInnerHTML`).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { YouTubeEmbedModal } from './YouTubeEmbedModal';
import DOMPurify from 'dompurify';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Link as LinkIcon, Unlink, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight,
  Palette, Highlighter, Eraser, Undo2, Redo2, Code, Youtube,
} from 'lucide-react';

/**
 * Extract a YouTube video ID from any of the common URL forms:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube-nocookie.com/embed/ID
 * Returns null if it doesn't look like a YouTube URL we can embed.
 */
export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  // Bare 11-char id
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v') || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
      const m = url.pathname.match(/^\/(embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[2];
    }
  } catch { /* not a URL */ }
  return null;
}

/** Build the responsive HTML snippet inserted into the editor / stored in DB. */
export function youtubeEmbedHtml(videoId: string): string {
  // The wrapper div + inline padding-bottom keeps the 16:9 ratio without
  // needing extra CSS — works in both the editor preview and on the public
  // article/tip page (prose container).
  return (
    `<div class="youtube-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0;border-radius:0.75rem;">` +
    `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}" ` +
    `title="YouTube video" frameborder="0" allowfullscreen ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
    `style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>` +
    `</div>`
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

// Sanitizer config matched to the tags/attributes our toolbar can produce.
// DOMPurify defaults already cover most of these — we explicitly allow
// `style` (color/background-color only — see hook below) and `target` on
// links so external URLs open in a new tab.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'a', 'span', 'div', 'img',
  'code', 'pre', 'hr',
  // YouTube embed support — iframe is restricted to youtube hosts via the
  // hook below; the wrapper div uses inline styles for its 16:9 aspect ratio.
  'iframe',
];
const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'src', 'alt', 'title', 'style', 'class',
  // iframe-specific attributes needed for the YouTube embed to behave well.
  'frameborder', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy',
  'width', 'height',
];

// Restrict inline `style` to a small whitelist:
//   - color / background-color  (toolbar color & highlight features)
//   - the layout properties used by the YouTube embed wrapper (position,
//     padding-bottom, height, overflow, margin, border-radius, top, left,
//     width, border). This is enough for the responsive 16:9 wrapper but
//     still blocks dangerous values (background-image url(), expression(), etc.).
const STYLE_ALLOW = /^(color|background-color|position|padding-bottom|height|overflow|margin|border-radius|top|left|width|border)\s*:\s*[#a-z0-9(),.\s%-]+$/i;
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'style') {
    const safe = (data.attrValue || '')
      .split(';')
      .map((d) => d.trim())
      .filter((d) => STYLE_ALLOW.test(d))
      .join('; ');
    data.attrValue = safe;
    if (!safe) data.keepAttr = false;
  }
});

// Iframe lockdown — only allow YouTube (incl. nocookie) embeds. Anything
// else gets the iframe stripped entirely. This runs BEFORE attribute
// sanitization so a bad src kills the node.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'iframe') return;
  const src = (node as Element).getAttribute('src') || '';
  const ok = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\/[a-zA-Z0-9_-]{11}([?&][^"'<>]*)?$/.test(src);
  if (!ok) {
    (node as Element).remove();
  }
});

// Keep ADD_TAGS/ADD_ATTR so DOMPurify keeps the iframe + its attrs even
// though the element-level hook is what actually validates the src.
export const sanitizeRichHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder'],
  });

const TEXT_COLORS = [
  '#0f172a', '#475569', '#dc2626', '#ea580c', '#d97706',
  '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777',
];
const HIGHLIGHT_COLORS = [
  'transparent', '#fef08a', '#fed7aa', '#fecaca', '#bbf7d0',
  '#bae6fd', '#ddd6fe', '#fbcfe8',
];

const ToolbarBtn: React.FC<{
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, children }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    className={`p-1.5 rounded-md transition-colors ${
      active ? 'bg-primary-100 text-primary-700' : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
);

const Divider = () => <span className="w-px h-5 bg-slate-200 mx-0.5" />;

export const RichTextEditor: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Rédigez votre contenu…',
  minHeight = 280,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [hlOpen, setHlOpen] = useState(false);
  const [ytModalOpen, setYtModalOpen] = useState(false);
  // Cached selection range — modals steal focus from contentEditable, so we
  // remember where the caret was when the YouTube button was clicked and
  // restore it before inserting the embed.
  const savedRangeRef = useRef<Range | null>(null);

  // Keep the editor in sync with the parent's `value` ONLY when it differs
  // from what the editor already shows. Naively setting innerHTML on every
  // render would wipe the user's selection on every keystroke.
  useEffect(() => {
    if (!editorRef.current) return;
    const incoming = value || '';
    if (editorRef.current.innerHTML !== incoming) {
      editorRef.current.innerHTML = incoming;
    }
  }, [value]);

  const exec = useCallback((command: string, arg?: string) => {
    editorRef.current?.focus();
    // Some browsers reject CSS styling without this.
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, arg);
    // Force a re-emit so onChange fires immediately after a button click.
    if (editorRef.current) {
      onChange(sanitizeRichHtml(editorRef.current.innerHTML));
    }
  }, [onChange]);

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange(sanitizeRichHtml(editorRef.current.innerHTML));
  };

  const formatBlock = (tag: string) => exec('formatBlock', tag);

  const setLink = () => {
    const sel = window.getSelection();
    const existing = sel?.toString() ? '' : '';
    const url = window.prompt('URL du lien (https://…)', existing);
    if (!url) return;
    // Validate http(s) only — block javascript: / data: links at the source.
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('mailto:')) {
      window.alert('URL invalide. Utilisez http(s):// ou mailto:');
      return;
    }
    exec('createLink', url);
    // Mark the just-created link to open in a new tab — execCommand can't.
    // We walk the editor and add target/rel to anchors that don't have them.
    if (editorRef.current) {
      editorRef.current.querySelectorAll('a').forEach((a) => {
        if (!a.getAttribute('target')) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      });
      onChange(sanitizeRichHtml(editorRef.current.innerHTML));
    }
  };

  const insertImage = () => {
    const url = window.prompt('URL de l’image (https://…)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      window.alert('URL invalide.');
      return;
    }
    exec('insertImage', url);
  };

  // Open the YouTube modal. We snapshot the current selection because the
  // modal will move focus, and execCommand('insertHTML') needs a valid
  // range inside the editor to insert at the right spot.
  const openYouTubeModal = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }
    setYtModalOpen(true);
  };

  const handleYouTubeInsert = (videoId: string) => {
    editorRef.current?.focus();
    // Restore the caret position from before the modal opened.
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    document.execCommand('insertHTML', false, youtubeEmbedHtml(videoId));
    if (editorRef.current) {
      onChange(sanitizeRichHtml(editorRef.current.innerHTML));
    }
    savedRangeRef.current = null;
  };

  // Paste handler: strip rich formatting that came from Word/Docs/etc.
  // We accept plain text + a curated subset of HTML (sanitizer will trim
  // whatever we don't understand).
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const cleaned = html ? sanitizeRichHtml(html) : text.replace(/\n/g, '<br/>');
    document.execCommand('insertHTML', false, cleaned);
  };

  return (
    <>
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <ToolbarBtn onClick={() => exec('undo')} title="Annuler"><Undo2 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('redo')} title="Rétablir"><Redo2 size={15} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => formatBlock('H1')} title="Titre 1"><Heading1 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => formatBlock('H2')} title="Titre 2"><Heading2 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => formatBlock('H3')} title="Titre 3"><Heading3 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => formatBlock('P')} title="Paragraphe"><span className="text-[11px] font-bold px-1">P</span></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => exec('bold')} title="Gras"><Bold size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('italic')} title="Italique"><Italic size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('underline')} title="Souligné"><UnderlineIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('strikeThrough')} title="Barré"><Strikethrough size={15} /></ToolbarBtn>
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
                  onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c); setColorOpen(false); }}
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
                  onMouseDown={(e) => { e.preventDefault(); exec('hiliteColor', c); setHlOpen(false); }}
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
        <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Liste à puces"><List size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Liste numérotée"><ListOrdered size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => formatBlock('BLOCKQUOTE')} title="Citation"><Quote size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => formatBlock('PRE')} title="Bloc de code"><Code size={15} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => exec('justifyLeft')} title="Aligner à gauche"><AlignLeft size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyCenter')} title="Centrer"><AlignCenter size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyRight')} title="Aligner à droite"><AlignRight size={15} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={setLink} title="Insérer un lien"><LinkIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('unlink')} title="Retirer le lien"><Unlink size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={insertImage} title="Insérer une image"><ImageIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={openYouTubeModal} title="Insérer une vidéo YouTube"><Youtube size={15} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => exec('removeFormat')} title="Effacer le formatage"><Eraser size={15} /></ToolbarBtn>
      </div>

      {/* Editing surface — `prose` classes here mirror the public page so
          the admin sees the final typography while typing. */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="prose prose-slate max-w-none p-4 focus:outline-none
                   prose-headings:font-black prose-headings:text-slate-900
                   prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                   prose-p:text-slate-700 prose-p:leading-relaxed
                   prose-a:text-primary-600 prose-a:font-bold
                   prose-blockquote:border-l-[3px] prose-blockquote:border-primary-500
                   prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4
                   prose-blockquote:rounded-r prose-blockquote:not-italic
                   prose-img:rounded-lg prose-img:my-4
                   prose-li:my-1
                   empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400
                   empty:before:pointer-events-none"
        style={{ minHeight }}
      />
    </div>
    <YouTubeEmbedModal
      open={ytModalOpen}
      onClose={() => setYtModalOpen(false)}
      onInsert={handleYouTubeInsert}
    />
    </>
  );
};

export default RichTextEditor;
