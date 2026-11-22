import { describe, expect, it } from 'vitest';
import { blogPostingLd, courseLd, personLd } from './structured-data';
import { SITE } from './site';

describe('strukturierte Daten', () => {
  it('beschreibt Lars ohne private Kontaktdaten', () => {
    const json = JSON.stringify(personLd());
    expect(personLd().sameAs).toContain('https://github.com/larmic');
    expect(json).not.toContain(SITE.mail);
    expect(json).not.toContain('email');
  });

  it('verweist im Workshop auf Lars als Trainer und neusta als Anbieter', () => {
    const course = courseLd({
      id: 'event_storming',
      data: { title: 'Event Storming', teaser: '…', format: 'Präsenz' },
    });
    expect(course.url).toBe('https://larmic.de/workshops/event_storming/');
    expect(course.provider.name).toBe('neusta GmbH');
    expect(course.hasCourseInstance.instructor['@id']).toBe(personLd()['@id']);
    expect(course.hasCourseInstance.courseMode).toEqual(['Onsite']);
  });

  const post = {
    id: 'erst-die-zaeune',
    data: { title: 'Erst die Zäune', teaser: '…', date: new Date('2026-11-22'), tags: ['guards', 'ki'] },
  };

  it('beschreibt einen Blogpost mit Lars als Autor und der Serie, zu der er gehört', () => {
    const ld = blogPostingLd(post, { id: 'mitwachsen', title: 'Mitwachsen' });
    expect(ld.url).toBe('https://larmic.de/blog/erst-die-zaeune/');
    expect(ld.datePublished).toBe('2026-11-22');
    expect(ld.author['@id']).toBe(personLd()['@id']);
    expect(ld.keywords).toBe('guards, ki');
    expect(ld.isPartOf).toEqual({
      '@type': 'CreativeWorkSeries',
      name: 'Mitwachsen',
      url: 'https://larmic.de/blog/serie/mitwachsen/',
    });
  });

  it('lässt bei einer Notiz die Serie weg', () => {
    expect(blogPostingLd(post)).not.toHaveProperty('isPartOf');
  });
});
