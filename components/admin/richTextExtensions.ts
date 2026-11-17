/**
 * Tiptap schema for the admin article / tip editor.
 *
 * Kept apart from the React component so the round-trip tests
 * (utils/richTextRoundTrip.test.ts) load the exact same schema in Node.
 *
 * Goal: opening an existing article and saving it again must not change what
 * visitors see. The published content (Nov 2026) was checked element by
 * element; each rule below exists because of a pattern found in it:
 *   - YouTube blocks are written back in OUR `div.youtube-embed` format
 *     (utils/richHtml.ts), not Tiptap's own YouTube markup.
 *   - Links keep their own target/rel. Tiptap's default adds
 *     `rel="nofollow"` + `target="_blank"` to every link, which would turn
 *     internal links into nofollow links.
 *   - Inline `style` and `class` on paragraphs, headings, lists, quotes,
 *     links and bold text are kept as they are (pasted colours/margins,
 *     Tailwind classes on older articles).
 *   - A `<div class="…">` box (e.g. the orange tip box) stays a box.
 *   - A plain `<div style="text-align:…">` keeps its alignment.
 *   - Images stay inline inside their paragraph, as the old editor wrote them.
 *
 * Extra modules (all MIT): tables, accordion, checklist, subscript and
 * superscript. Every tag they write is allowed by sanitizeRichHtml, so it
 * also shows on the public page.
 */
import { Extension, Node } from '@tiptap/core';
import Paragraph from '@tiptap/extension-paragraph';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color, BackgroundColor } from '@tiptap/extension-text-style';
import { TableKit } from '@tiptap/extension-table';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import {
  parseYouTubeId,
  youtubeEmbedSrc,
  YOUTUBE_IFRAME_ALLOW,
  YOUTUBE_IFRAME_STYLE,
  YOUTUBE_WRAPPER_STYLE,
} from '../../utils/richHtml';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    youtubeEmbed: {
      /** Insert our responsive YouTube block at the cursor. */
      setYoutubeVideo: (videoId: string) => ReturnType;
    };
  }
}

const BLOCK_TAGS = 'p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,pre,hr,table,iframe,img,figure';

/** `style` without text-align — TextAlign owns that property. */
function styleWithoutAlign(el: HTMLElement): string | null {
  const raw = el.getAttribute('style') || '';
  const kept = raw
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && !/^text-align\s*:/i.test(d))
    .join('; ');
  return kept || null;
}

const legacyStyle = {
  default: null,
  parseHTML: (el: HTMLElement) => styleWithoutAlign(el),
  renderHTML: (attrs: Record<string, unknown>) =>
    attrs.legacyStyle ? { style: String(attrs.legacyStyle) } : {},
};
const legacyClass = {
  default: null,
  parseHTML: (el: HTMLElement) => el.getAttribute('class') || null,
  renderHTML: (attrs: Record<string, unknown>) =>
    attrs.legacyClass ? { class: String(attrs.legacyClass) } : {},
};

/** Keeps inline style / class that older articles already carry. */
const PreservedAttributes = Extension.create({
  name: 'preservedAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'callout'],
        attributes: { legacyStyle, legacyClass },
      },
      { types: ['link', 'bold'], attributes: { legacyStyle } },
    ];
  },
});

/** `<div>` that only holds text (no blocks) → paragraph, keeping its alignment. */
const ParagraphWithDiv = Paragraph.extend({
  parseHTML() {
    return [
      ...(this.parent?.() ?? []),
      {
        tag: 'div',
        priority: 40,
        getAttrs: (el) => ((el as HTMLElement).querySelector(BLOCK_TAGS) ? false : null),
      },
    ];
  },
});

/** A styled box (`<div class="…">` holding blocks), e.g. the orange tip box. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [
      {
        tag: 'div[class]',
        getAttrs: (el) => ((el as HTMLElement).classList.contains('youtube-embed') ? false : null),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0];
  },
});

const idFromIframe = (iframe: Element | null) => {
  const id = iframe ? parseYouTubeId(iframe.getAttribute('src') || '') : null;
  return id ? { videoId: id } : false;
};

/** YouTube block, read and written in the `div.youtube-embed` format. */
export const YoutubeEmbed = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { videoId: { default: null, renderHTML: () => ({}) } };
  },
  parseHTML() {
    return [
      { tag: 'div.youtube-embed', priority: 100, getAttrs: (el) => idFromIframe((el as HTMLElement).querySelector('iframe')) },
      { tag: 'div[data-youtube-video]', priority: 100, getAttrs: (el) => idFromIframe((el as HTMLElement).querySelector('iframe')) },
      { tag: 'iframe', getAttrs: (el) => idFromIframe(el as HTMLElement) },
    ];
  },
  renderHTML({ node }) {
    return [
      'div',
      { class: 'youtube-embed', style: YOUTUBE_WRAPPER_STYLE },
      [
        'iframe',
        {
          src: youtubeEmbedSrc(String(node.attrs.videoId)),
          title: 'YouTube video',
          frameborder: '0',
          allowfullscreen: '',
          allow: YOUTUBE_IFRAME_ALLOW,
          style: YOUTUBE_IFRAME_STYLE,
        },
      ],
    ];
  },
  addCommands() {
    return {
      setYoutubeVideo:
        (videoId: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { videoId } }),
    };
  },
});

/** The schema shared by the editor and the tests. */
export function richTextExtensions() {
  return [
    StarterKit.configure({
      paragraph: false,
      heading: { levels: [1, 2, 3, 4] },
      // No automatic empty paragraph at the end: it would change saved HTML.
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: false,
        // null = keep each link's own target/rel; never add nofollow.
        HTMLAttributes: { target: null, rel: null },
      },
    }),
    ParagraphWithDiv,
    Image.configure({ inline: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    BackgroundColor,
    Callout,
    YoutubeEmbed,
    PreservedAttributes,
    // Tables (pasted from Word / Docs / Excel / a website, or built with the
    // toolbar). Column resizing is off: widths would be stored as pixels and
    // break the table on phones.
    TableKit.configure({ table: { resizable: false } }),
    // Accordion (<details><summary>) — FAQ-style blocks; the content stays in
    // the HTML, so Google reads it.
    Details.configure({ persist: true }),
    DetailsSummary,
    DetailsContent,
    // Checklist (« ce qu'il vous faut », étapes d'entretien).
    TaskList,
    TaskItem.configure({ nested: true }),
    // cm³, CO₂…
    Subscript,
    Superscript,
  ];
}
