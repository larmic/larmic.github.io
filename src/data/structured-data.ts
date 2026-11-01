// Strukturierte Daten (schema.org als JSON-LD) für Suchmaschinen: wer Lars ist und welche Workshops es gibt.
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
