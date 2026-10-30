// Garage directory: kept out of search engines until real garages are listed
// (the current entries are demo data). Set to true to index /garages and
// /garage/* again with their AutoRepair JSON-LD. Read by the app, the
// prerender function (api/og-prerender.ts) and the build-time snapshots.
// The backend sitemap has its own switch: SITEMAP_INCLUDE_GARAGES=1.
export const GARAGES_PUBLIC = false;

export const GARAGES_ROBOTS = 'noindex, follow';
