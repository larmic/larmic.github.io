import { describe, expect, it } from 'vitest';
import { courseLd, personLd } from './structured-data';
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
});
