/** Match free-text section labels ("Math Module 2", "RW1", "English") to sections. */

export interface SectionLike {
  id: string;
  name: string;
  shortName: string;
  aliases: string[];
  scaleId: string;
}

export interface ScaleLike {
  id: string;
  name: string;
}

export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bmod\b/g, 'module')
    .trim();
}

function labelsFor(section: SectionLike): string[] {
  return [section.id, section.name, section.shortName, ...section.aliases].map(normalizeLabel);
}

export type SectionMatch<S> = { kind: 'section'; section: S } | { kind: 'group'; sections: S[] };

/**
 * Resolve a label to one section, or to a group of sections sharing a score
 * scale (e.g. "Reading and Writing" on the SAT covers both modules).
 */
export function resolveSectionLabel<S extends SectionLike>(
  label: string,
  sections: S[],
  scales: ScaleLike[] = [],
): SectionMatch<S> | null {
  const norm = normalizeLabel(label);
  if (!norm) return null;
  const padded = ` ${norm} `;

  for (const section of sections) {
    if (labelsFor(section).includes(norm)) return { kind: 'section', section };
  }

  // Longest alias appearing as whole words inside the label.
  let best: { section: S; length: number } | null = null;
  for (const section of sections) {
    for (const alias of labelsFor(section)) {
      if (alias.length >= 3 && padded.includes(` ${alias} `) && (!best || alias.length > best.length)) {
        best = { section, length: alias.length };
      }
    }
  }
  if (best) return { kind: 'section', section: best.section };

  for (const scale of scales) {
    const scaleLabel = normalizeLabel(scale.name);
    if (norm === scaleLabel || padded.includes(` ${scaleLabel} `) || norm === normalizeLabel(scale.id)) {
      const group = sections.filter((s) => s.scaleId === scale.id);
      if (group.length === 1) return { kind: 'section', section: group[0] };
      if (group.length > 1) return { kind: 'group', sections: group };
    }
  }
  return null;
}
