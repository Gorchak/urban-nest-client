import { writeFile } from 'node:fs/promises';

const apiUrl = process.env.PRERENDER_API_URL || 'https://api.uliastore.com.ua/api';
const routes = new Set(['/', '/new-arrivals']);

const routeSegment = (value) => encodeURIComponent(String(value || ''));

async function fetchJson(path) {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchAll(path, limit = 100) {
  const separator = path.includes('?') ? '&' : '?';
  const first = await fetchJson(`${path}${separator}page=1&limit=${limit}`);
  const data = [...(first.data || [])];
  const pages = Number(first.pagination?.pages || 1);

  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchJson(`${path}${separator}page=${page}&limit=${limit}`);
    data.push(...(next.data || []));
  }

  return data;
}

try {
  const [categories, products] = await Promise.all([
    fetchAll('/categories', 100),
    fetchAll('/merchandise?isActive=true&isVisible=true', 100),
  ]);

  categories
    .filter((category) => category?.slug && category.isActive && category.isVisible)
    .forEach((category) => routes.add(`/category/${routeSegment(category.slug)}`));

  products
    .filter((product) => product?.slug && product.isActive && product.isVisible)
    .forEach((product) => routes.add(`/product/${routeSegment(product.slug)}`));
} catch (error) {
  console.warn(`Could not fetch prerender routes from ${apiUrl}: ${error.message}`);
}

await writeFile('routes.txt', `${[...routes].sort().join('\n')}\n`);
console.log(`Generated ${routes.size} prerender route(s).`);
