import { mkdir, readFile, writeFile } from 'node:fs/promises';

const DEFAULT_SITE_URL = 'https://urban-nest-dev.netlify.app';
const siteUrl = String(process.env.SITE_URL || process.env.FRONTEND_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const normalizeRoute = (route) => {
  const cleanRoute = String(route || '').trim();
  if (!cleanRoute) return null;
  return cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`;
};

const routePriority = (route) => {
  if (route === '/') return '1.0';
  if (route === '/new-arrivals') return '0.8';
  if (route.startsWith('/category/')) return '0.8';
  if (route.startsWith('/product/')) return '0.7';
  return '0.6';
};

const routeChangefreq = (route) => {
  if (route === '/' || route === '/new-arrivals') return 'daily';
  return 'weekly';
};

const routesText = await readFile('routes.txt', 'utf8');
const routes = [...new Set(routesText.split(/\r?\n/).map(normalizeRoute).filter(Boolean))].sort();

const sitemapEntries = routes.map((route) => `  <url>
    <loc>${escapeXml(`${siteUrl}${route}`)}</loc>
    <changefreq>${routeChangefreq(route)}</changefreq>
    <priority>${routePriority(route)}</priority>
  </url>`).join('\n');

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`;

const robotsTxt = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /admin',
  'Disallow: /checkout',
  'Disallow: /purchase-history',
  '',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  '',
].join('\n');

await mkdir('public', { recursive: true });
await Promise.all([
  writeFile('public/sitemap.xml', sitemapXml),
  writeFile('public/robots.txt', robotsTxt),
]);

console.log(`Generated sitemap.xml and robots.txt for ${routes.length} route(s) at ${siteUrl}.`);
