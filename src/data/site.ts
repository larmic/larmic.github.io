import type { Material } from './materials';

// Zentrale Seitendaten. Texte der Startseite stehen direkt in den Komponenten unter src/components/.
export const SITE = {
  title: 'larmic.de',
  description:
    'Lars Michaelis – Entwickler, Architekt, Speaker und Berater. Software mit fachlichem Kern und KI mit Leitplanken; Workshops zu Domain-Driven Design, Event Storming und Microservices.',
  url: 'https://larmic.de',
  mail: 'mail@larmic.de', // privat, nur per JavaScript als Link (MailLink.astro)
  workshopMail: 'l.michaelis@neusta.de', // Workshops und Beratung laufen über team neusta
};

export const SOCIALS = [
  { name: 'GitHub', href: 'https://github.com/larmic' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/lars-michaelis-6778761b3/' },
  { name: 'YouTube', href: 'https://www.youtube.com/channel/UCuJB-Eqjil4ZTGCK2UeDl9g' },
  { name: 'Xing', href: 'https://www.xing.com/profile/Lars_Michaelis2/cv' },
];

// Sprechblasen der Figur je Bereich – auf der Insel und auf den Detailseiten
export const BUBBLES = {
  about: 'Das bin ich. Entwicklung, Architektur und KI mit Leitplanken.',
  workshops: 'Lass uns gemeinsam modellieren!',
  videos: 'Popcorn bereit? Hier sind meine Talks.',
  tree: 'Schöne Aussicht!', // Easter Egg: oben im Baum
};

/** Mail-Link für Workshop- und Beratungsanfragen, optional mit Betreff */
export const workshopMailto = (subject = 'Anfrage Workshop oder Beratung') =>
  `mailto:${SITE.workshopMail}?subject=${encodeURIComponent(subject)}`;

export const FOCUS = ['Domain-Driven Design', 'Hexagonale Architektur', 'Event Storming', 'Microservices', 'DevSecOps'];

export type Kit = {
  id: Exclude<Material, 'gr'>; // Material der Kiste: Block und Farbe kommen aus MATERIALS
  title: string;
  sub: string;
  items: { label: string; color: string }[];
};

// Drei Kisten mit je sechs Slots. `color` tönt den Block.
export const KITS: Kit[] = [
  {
    id: 'hw',
    title: 'Werkzeugkiste',
    sub: 'Das Handwerk: solide Software bauen.',
    items: [
      { label: 'Kotlin', color: '#7f52ff' },
      { label: 'Spring Boot', color: '#6db33f' },
      { label: 'Go', color: '#00add8' },
      { label: 'React', color: '#61dafb' },
      { label: 'Web Components', color: '#f0a531' },
      { label: 'Testcontainers', color: '#3fa7a0' },
    ],
  },
  {
    id: 'ops',
    title: 'DevOps-Kiste',
    sub: 'Vom Commit bis in Produktion.',
    items: [
      { label: 'Kubernetes', color: '#326ce5' },
      { label: 'K9s', color: '#8fb8de' },
      { label: 'ArgoCD', color: '#e8774e' },
      { label: 'GitLab CI', color: '#fca326' },
      { label: 'GitHub Actions', color: '#6e7781' },
      { label: 'Continuous Delivery', color: '#4caf74' },
    ],
  },
  {
    id: 'ki',
    title: 'KI-Werkzeugkiste',
    sub: 'Damit die KI nicht nur schnell, sondern auch richtig baut.',
    items: [
      { label: 'KI', color: '#b48cf0' },
      { label: 'Claude Code', color: '#e0855f' },
      { label: 'Spec-Driven', color: '#4fd1d9' },
      { label: 'Guard-Gates', color: '#ff6b5e' },
      { label: 'ArchUnit', color: '#f2c14e' },
      { label: 'BDD', color: '#f08cc0' },
    ],
  },
];

// Kommentare über giscus (GitHub Discussions). Werte von https://giscus.app eintragen,
// dann erscheinen Kommentare unter jeder Videoseite. Leer = keine Kommentare.
export const GISCUS = {
  repo: '', // z. B. 'larmic/larmic.github.io'
  repoId: '',
  category: '', // z. B. 'Kommentare'
  categoryId: '',
};
