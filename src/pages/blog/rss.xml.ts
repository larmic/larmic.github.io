// Feed des Blogs (RSS 2.0): alle veröffentlichten Posts, neueste zuerst, mit dem Teaser als Beschreibung.
import { loadBlog } from '../../data/blog';
import { SITE } from '../../data/site';
import { rss } from '../../lib/blog/rss';

export async function GET() {
  const { posts } = await loadBlog();
  const xml = rss({
    title: `${SITE.title} – Blog`,
    description: 'Notizen eines Architekten, der nebenbei Vater ist.',
    link: `${SITE.url}/blog/`,
    self: `${SITE.url}/blog/rss.xml`,
    items: posts.map((p) => ({
      title: p.data.title,
      link: `${SITE.url}/blog/${p.id}/`,
      description: p.data.teaser,
      date: p.data.date,
      categories: p.data.tags,
    })),
  });
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
