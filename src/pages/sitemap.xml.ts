// Alte Adresse /sitemap.xml (Hugo, evtl. in der Search Console hinterlegt): verweist auf die neue Sitemap.
export function GET() {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://larmic.de/sitemap-0.xml</loc></sitemap></sitemapindex>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
