/** Every @type in a JSON-LD value (single node, array, @graph, type arrays). */
export function jsonLdTypes(value: unknown): Set<string> {
  const types = new Set<string>();
  const visit = (node: any) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    const t = node['@type'];
    (Array.isArray(t) ? t : t ? [t] : []).forEach((x: unknown) => types.add(String(x)));
    if (Array.isArray(node['@graph'])) node['@graph'].forEach(visit);
  };
  visit(value);
  return types;
}

/**
 * Page schemas whose type the server JSON-LD does not already describe.
 * On the landing page the server blocks win (two Product or FAQPage blocks
 * contradicted each other), but a type they lack — the /annonces ItemList,
 * built from live listings — is still added.
 */
export function schemasMissingFromServer<T>(schemas: T[], serverTypes: Set<string>): T[] {
  return schemas.filter((s) => {
    const own = jsonLdTypes(s);
    return own.size > 0 && ![...own].some((t) => serverTypes.has(t));
  });
}
