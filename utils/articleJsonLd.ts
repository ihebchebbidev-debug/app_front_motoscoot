import { readingTime, wordCount } from './editorial';

export const ARTICLE_CATEGORIES = ['Nouveautés', 'Essais', 'Tech', 'Scooters', 'Électrique'];

export const CLAUDE_ARTICLE_PROMPT = `Rédige pour Moto-Scoot.tn un article sur le sujet que je vais préciser. Renvoie un seul objet JSON-LD valide, prêt à importer, dans la langue demandée. Vérifie les faits et les prix en Tunisie. Cite les sources utilisées dans le corps et omets les données invérifiables.

Utilise ce format et remplace les valeurs par le texte final.
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Titre de l’article",
  "description": "Résumé en une ou deux phrases.",
  "articleSection": "Scooters",
  "keywords": ["scooter", "Tunisie"],
  "articleBody": "<p>Introduction complète.</p><h2>Premier intertitre</h2><p>Texte de la section.</p>"
}

Écris l’article entier dans articleBody. Utilise du HTML simple pour les paragraphes, intertitres, listes ou tableaux. Choisis la rubrique parmi ${ARTICLE_CATEGORIES.join(', ')}. Ajoute image uniquement si je fournis une URL de couverture. Échappe correctement les guillemets du HTML pour que le JSON soit valide.`;

type JsonNode = Record<string, unknown>;
const object = (v: unknown): v is JsonNode => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [v];
const types = new Set(['Article', 'BlogPosting', 'NewsArticle']);

function coverImage(value: unknown, nodes: JsonNode[]): string {
  for (const item of list(value)) {
    const ref = object(item) && text(item['@id']);
    const image = ref ? nodes.find(n => n['@id'] === ref) ?? item : item;
    const src = object(image) ? text(image.contentUrl) || text(image.url) || text(image['@id']) : text(image);
    if (!src) continue;
    if (src.startsWith('/uploads/')) return src;
    if (/^https?:\/\//i.test(src) && URL.canParse(src)) return src;
  }
  return '';
}

function bodyHtml(body: string): string {
  if (/<\/?[a-z][\w-]*(?:\s[^>]*|\s*\/?)>/i.test(body)) return body;
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.split(/\r?\n\s*\n/).map(p => '<p>' + p.replace(/\r?\n/g, '<br>') + '</p>').join('');
}

export function importArticleJsonLd(source: string, sanitize: (html: string) => string) {
  let input = source.trim();
  const fence = input.match(/^```(?:json(?:-?ld)?|html)?\s*\n([\s\S]*?)\n?```$/i);
  if (fence) input = fence[1].trim();
  const script = input.match(/^<script\b[^>]*\stype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>$/i);
  if (script) input = script[1].trim();
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    throw new Error('JSON invalide. Vérifiez les guillemets, les virgules et les accolades.');
  }
  const nodes = list(data).filter(object).flatMap(n => [n, ...list(n['@graph']).filter(object)]);
  const articles = nodes.filter(n => list(n['@type']).some(t => types.has(text(t).replace(/^https?:\/\/schema\.org\//i, ''))));
  if (articles.length !== 1) {
    throw new Error(articles.length ? 'Importez un seul article à la fois.' : 'Type attendu : Article, BlogPosting ou NewsArticle.');
  }
  const a = articles[0];
  const title = text(a.headline) || text(a.name);
  if (!title || [...title].length > 300) throw new Error('Indiquez un titre (headline) de 1 à 300 caractères.');
  const body = text(a.articleBody);
  if (!body) throw new Error('Le texte complet manque dans articleBody. Un résumé seul ne suffit pas.');
  const content = sanitize(bodyHtml(body));
  if (!wordCount(content)) throw new Error('Le corps de l’article ne contient aucun texte lisible.');
  const sections = list(a.articleSection).map(s => text(s).toLocaleLowerCase('fr'));
  const category = ARTICLE_CATEGORIES.find(c => sections.includes(c.toLocaleLowerCase('fr')));
  if (sections.some(Boolean) && !category) throw new Error('Rubrique inconnue. Choisissez parmi ' + ARTICLE_CATEGORIES.join(', ') + '.');
  const tags = list(a.keywords).flatMap(v => text(v).split(',')).map(s => s.trim()).filter(Boolean);
  return {
    title, content, category: category || ARTICLE_CATEGORIES[0], summary: text(a.description),
    image: coverImage(a.image, nodes), tags: [...new Set(tags)].join(', '),
    read_time: parseInt(readingTime(content), 10), is_published: false, is_featured: false,
  };
}

export type ImportedArticle = ReturnType<typeof importArticleJsonLd>;
