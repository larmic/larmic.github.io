// Materialien: Jedes steht für ein Thema und hat überall dieselbe Farbe – auf Karten, Kisten und Werkzeugkisten.
// Einzige Quelle für Block, Icon- und Play-Farbe. Flächen, Slots und Rahmen braucht nur CSS: tokens.css.
export const MATERIALS = {
  hw: { name: 'Holz', theme: 'Handwerk, Architektur', block: 'crate', icon: '#a0703f', play: '#f0a531' },
  ops: { name: 'Metall', theme: 'DevOps, Infrastruktur', block: 'metal', icon: '#7d8ea3', play: '#6b9bff' },
  ki: { name: 'Kristall', theme: 'KI, Event Storming', block: 'crystal', icon: '#b48cf0', play: '#b48cf0' },
  gr: { name: 'Gras', theme: 'Testing', block: 'grass', icon: undefined, play: '#6cc46f' }, // Grasblock ist nicht getönt
} as const;

export type Material = keyof typeof MATERIALS;

/** Für das Schema der Inhalte (z. B. `material: "hw"` in einem Workshop) */
export const MATERIAL_IDS = Object.keys(MATERIALS) as [Material, ...Material[]];
