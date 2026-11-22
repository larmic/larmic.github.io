// Strukturierte Daten (schema.org als JSON-LD) für Suchmaschinen: wer Lars ist, welche Workshops es gibt und
// was im Blog steht.
// Ohne Mail und Adresse – die private Mail steht bewusst nicht im HTML.
import { FOCUS, SITE, SOCIALS } from './site';

const PERSON_ID = `${SITE.url}/#person`;

const NEUSTA = { '@type': 'Organization', name: 'neusta GmbH', url: 'https://www.team-neusta.de/de' };

export function personLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Lars Michaelis',
    url: `${SITE.url}/`,
    jobTitle: 'Entwickler, Architekt, Speaker und Berater',
    worksFor: NEUSTA,
    knowsAbout: FOCUS,
    sameAs: SOCIALS.map((s) => s.href),
  };
}

type Workshop = {
  id: string;
  data: { title: string; teaser: string; format: 'Präsenz' | 'Präsenz oder remote' | 'Remote' };
};

const COURSE_MODE = { Präsenz: ['Onsite'], 'Präsenz oder remote': ['Onsite', 'Online'], Remote: ['Online'] };

export function courseLd(w: Workshop) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: w.data.title,
    description: w.data.teaser,
    url: `${SITE.url}/workshops/${w.id}/`,
    inLanguage: 'de',
    provider: NEUSTA,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: COURSE_MODE[w.data.format],
      instructor: { '@type': 'Person', '@id': PERSON_ID, name: 'Lars Michaelis' },
    },
  };
}

type BlogPost = { id: string; data: { title: string; teaser: string; date: Date; tags: readonly string[] } };

export function blogPostingLd(p: BlogPost, series?: { id: string; title: string }) {
  const url = `${SITE.url}/blog/${p.id}/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.data.title,
    description: p.data.teaser,
    datePublished: p.data.date.toISOString().slice(0, 10),
    inLanguage: 'de',
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Person', '@id': PERSON_ID, name: 'Lars Michaelis' },
    keywords: p.data.tags.join(', '),
    ...(series && {
      isPartOf: { '@type': 'CreativeWorkSeries', name: series.title, url: `${SITE.url}/blog/serie/${series.id}/` },
    }),
  };
}
