/**
 * Reading styles shared by the article (ArticleDetails) and guide (TipDetails)
 * bodies. Kept in components/ so Tailwind scans the class names.
 *
 * - Body text gray-800 (#1F2937, about 14:1 on white) instead of gray-600.
 * - Links orange-700, semibold, underlined, and long raw URLs may break
 *   anywhere instead of running past the column on phones.
 * - Headings weight 800, not 900.
 * - One vertical rhythm: 1.5 rem between paragraphs and list items' blocks,
 *   3 rem above an h2, 2.5 rem above an h3, 2 rem around images and quotes.
 * - List bullets and numbers in the brand orange.
 * - Quotes upright and regular weight (italic bold paragraphs read poorly).
 *
 * Colours carry ! because texts pasted into the admin editor keep inline
 * colours (grey #384252 paragraphs, #E65400 links) that would win otherwise.
 *
 * The text size (prose-lg, md:prose-xl) stays with each page.
 */
export const READING_PROSE = [
  'prose prose-slate max-w-none',
  '[--tw-prose-body:theme(colors.gray.800)] [--tw-prose-bullets:theme(colors.primary.600)] [--tw-prose-counters:theme(colors.primary.600)]',
  'prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:!text-gray-900',
  'prose-h2:text-2xl md:prose-h2:text-[2rem] prose-h2:leading-tight prose-h2:mt-12 prose-h2:mb-4',
  'prose-h3:text-xl md:prose-h3:text-2xl prose-h3:leading-snug prose-h3:mt-10 prose-h3:mb-3',
  'prose-p:!text-gray-800 prose-p:leading-[1.75] prose-p:my-6',
  'prose-li:!text-gray-800 prose-strong:text-gray-900 [&_span]:!text-inherit',
  'prose-a:!text-orange-700 prose-a:font-semibold prose-a:underline prose-a:decoration-orange-700/40 prose-a:underline-offset-[3px] hover:prose-a:decoration-orange-700 prose-a:[overflow-wrap:anywhere]',
  'prose-img:rounded-2xl md:prose-img:rounded-[2rem] prose-img:shadow-lg prose-img:my-8',
  'prose-blockquote:border-l-4 prose-blockquote:border-primary-600 prose-blockquote:bg-gray-50 prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-2xl prose-blockquote:not-italic prose-blockquote:font-normal prose-blockquote:text-gray-800 prose-blockquote:my-8',
].join(' ');
