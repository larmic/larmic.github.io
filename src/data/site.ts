// Zentrale Seitendaten. Texte der Startseite stehen direkt in den Komponenten unter src/components/.
export const SITE = {
  title: 'larmic.de',
  description: 'Lars Michaelis – Entwickler, Speaker und Berater. Workshops zu Domain-Driven Design, Event Storming und Microservices.',
  url: 'https://larmic.de',
  mail: 'mail@larmic.de',
};

export const SOCIALS = [
  { name: 'GitHub', href: 'https://github.com/larmic' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/lars-michaelis-6778761b3/' },
  { name: 'Mastodon', href: 'https://mastodon.social/@larmic' },
  { name: 'YouTube', href: 'https://www.youtube.com/channel/UCuJB-Eqjil4ZTGCK2UeDl9g' },
  { name: 'X', href: 'https://twitter.com/larmicDE' },
  { name: 'Xing', href: 'https://www.xing.com/profile/Lars_Michaelis2/cv' },
];

// Sprechblasen der Figur je Bereich – auf der Insel und auf den Detailseiten
export const BUBBLES = {
  about: 'Das bin ich. Entwicklung, Architektur und KI mit Leitplanken.',
  workshops: 'Lass uns gemeinsam modellieren!',
  videos: 'Popcorn bereit? Hier sind meine Talks.',
  tree: 'Schöne Aussicht!', // Easter Egg: oben im Baum
};

export const FOCUS = ['Domain-Driven Design', 'Hexagonale Architektur', 'Event Storming', 'Microservices', 'DevSecOps'];

export type Kit = { id: 'hw' | 'ops' | 'ki'; title: string; sub: string; block: 'crate' | 'metal' | 'crystal'; icon: string; items: { label: string; color: string }[] };

// Drei Kisten mit je sechs Slots. `color` tönt den Block.
export const KITS: Kit[] = [
  {
    id: 'hw', title: 'Werkzeugkiste', sub: 'Das Handwerk: solide Software bauen.', block: 'crate', icon: '#a0703f',
    items: [
      { label: 'Kotlin', color: '#7f52ff' }, { label: 'Spring Boot', color: '#6db33f' }, { label: 'Go', color: '#00add8' },
      { label: 'React', color: '#61dafb' }, { label: 'Web Components', color: '#f0a531' }, { label: 'Testcontainers', color: '#3fa7a0' },
    ],
  },
  {
    id: 'ops', title: 'DevOps-Kiste', sub: 'Vom Commit bis in Produktion.', block: 'metal', icon: '#7d8ea3',
    items: [
      { label: 'Kubernetes', color: '#326ce5' }, { label: 'K9s', color: '#8fb8de' }, { label: 'ArgoCD', color: '#e8774e' },
      { label: 'GitLab CI', color: '#fca326' }, { label: 'GitHub Actions', color: '#6e7781' }, { label: 'Continuous Delivery', color: '#4caf74' },
    ],
  },
  {
    id: 'ki', title: 'KI-Werkzeugkiste', sub: 'Damit die KI nicht nur schnell, sondern auch richtig baut.', block: 'crystal', icon: '#b48cf0',
    items: [
      { label: 'KI', color: '#b48cf0' }, { label: 'Claude Code', color: '#e0855f' }, { label: 'Spec-Driven', color: '#4fd1d9' },
      { label: 'Guard-Gates', color: '#ff6b5e' }, { label: 'ArchUnit', color: '#f2c14e' }, { label: 'BDD', color: '#f08cc0' },
    ],
  },
];

// Materialien der Karten: Fläche + Block-Icon
export const MATERIALS = {
  hw: { block: 'crate', icon: '#a0703f', play: '#f0a531' },
  ops: { block: 'metal', icon: '#7d8ea3', play: '#6b9bff' },
  ki: { block: 'crystal', icon: '#b48cf0', play: '#b48cf0' },
  gr: { block: 'grass', icon: '', play: '#6cc46f' },
} as const;

// Kommentare über giscus (GitHub Discussions). Werte von https://giscus.app eintragen,
// dann erscheinen Kommentare unter jeder Videoseite. Leer = keine Kommentare.
export const GISCUS = {
  repo: '', // z. B. 'larmic/larmic.github.io'
  repoId: '',
  category: '', // z. B. 'Kommentare'
  categoryId: '',
};
