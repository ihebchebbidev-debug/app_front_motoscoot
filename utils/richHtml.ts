/**
 * Rich article HTML — the contract shared by the admin editor and the public
 * article / tip pages.
 *
 * `articles.content` and `tips.content` hold an HTML string. The admin editor
 * produces it, and ArticleDetails / TipDetails render it with
 * `dangerouslySetInnerHTML` after `sanitizeRichHtml`. Both sides use this one
 * sanitizer, so what the editor stores is exactly what visitors see.
 *
 * This file must stay free of editor code: the public pages import it, and the
 * editor library (Tiptap) must only ever load inside the admin.
 */
import DOMPurify from 'dompurify';

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

/**
 * The responsive YouTube block stored in the database. The wrapper's inline
 * padding-bottom keeps the 16:9 ratio without extra CSS, in the editor and on
 * the public page. The editor's YouTube node renders this exact markup.
 */
export const YOUTUBE_WRAPPER_STYLE =
  'position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0;border-radius:0.75rem;';
export const YOUTUBE_IFRAME_STYLE =
  'position:absolute;top:0;left:0;width:100%;height:100%;border:0;';
export const YOUTUBE_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
export const youtubeEmbedSrc = (videoId: string) => `https://www.youtube-nocookie.com/embed/${videoId}`;

/** Build the responsive HTML snippet stored in the database. */
export function youtubeEmbedHtml(videoId: string): string {
  return (
    `<div class="youtube-embed" style="${YOUTUBE_WRAPPER_STYLE}">` +
    `<iframe src="${youtubeEmbedSrc(videoId)}" ` +
    `title="YouTube video" frameborder="0" allowfullscreen ` +
    `allow="${YOUTUBE_IFRAME_ALLOW}" ` +
    `style="${YOUTUBE_IFRAME_STYLE}"></iframe>` +
    `</div>`
  );
}

// Sanitizer config matched to the tags/attributes the editor can produce.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'a', 'span', 'div', 'img',
  'code', 'pre', 'hr', 'sub', 'sup',
  // Tables (editor « Tableau » button, or pasted from Word / Docs / Excel).
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // Accordion (editor « Accordéon » button).
  'details', 'summary',
  // Checklist (editor « Liste de tâches » button). The input is forced to a
  // read-only checkbox by the hook below.
  'label', 'input',
  // YouTube embed support — iframe is restricted to youtube hosts via the
  // hook below; the wrapper div uses inline styles for its 16:9 aspect ratio.
  'iframe',
];
const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'src', 'alt', 'title', 'style', 'class',
  // iframe-specific attributes needed for the YouTube embed to behave well.
  'frameborder', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy',
  'width', 'height',
  // Tables, accordion, checklist.
  'colspan', 'rowspan', 'open', 'type', 'checked', 'disabled',
  'data-type', 'data-checked',
];

// Restrict inline `style` to a small whitelist:
//   - color / background-color  (toolbar color & highlight features)
//   - text-align                (toolbar alignment)
//   - the layout properties used by the YouTube embed wrapper (position,
//     padding-bottom, height, overflow, margin, border-radius, top, left,
//     width, border). This is enough for the responsive 16:9 wrapper but
//     still blocks dangerous values (background-image url(), expression(), etc.).
const STYLE_ALLOW = /^(color|background-color|text-align|position|padding-bottom|height|overflow|margin|border-radius|top|left|width|border)\s*:\s*[#a-z0-9(),.\s%-]+$/i;
const STYLE_HOOK_FLAG = '__motoscootRichHtmlHooks';

function installHooks() {
  const flagged = DOMPurify as unknown as Record<string, boolean>;
  if (flagged[STYLE_HOOK_FLAG]) return;
  flagged[STYLE_HOOK_FLAG] = true;

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

  // Checklist boxes: only a read-only checkbox may survive — no text fields,
  // buttons or anything a visitor could type into.
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'input') return;
    const el = node as Element;
    if ((el.getAttribute('type') || '').toLowerCase() !== 'checkbox') {
      el.remove();
      return;
    }
    el.setAttribute('disabled', '');
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
}

// Keep ADD_TAGS/ADD_ATTR so DOMPurify keeps the iframe + its attrs even
// though the element-level hook is what actually validates the src.
export const sanitizeRichHtml = (html: string): string => {
  installHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder'],
  });
};
