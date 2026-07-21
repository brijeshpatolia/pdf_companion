/**
 * A small, curated catalog of public-domain "hard books" sourced from
 * Project Gutenberg. Users add these to their library with one click; the
 * import route downloads the EPUB and runs it through the normal ingestion
 * pipeline. All titles are verified reachable and parse cleanly.
 */

export interface CatalogBook {
  /** Stable catalog id, e.g. "gutenberg-1497". */
  id: string;
  title: string;
  author: string;
  /** One-line pitch shown on the card. */
  description: string;
  gutenbergId: number;
}

export const CATALOG_SOURCE = "Project Gutenberg";

export const CATALOG: CatalogBook[] = [
  {
    id: "gutenberg-1497",
    title: "The Republic",
    author: "Plato",
    description: "Justice, the ideal city, and the allegory of the cave.",
    gutenbergId: 1497,
  },
  {
    id: "gutenberg-2680",
    title: "Meditations",
    author: "Marcus Aurelius",
    description: "The private Stoic notebook of a Roman emperor.",
    gutenbergId: 2680,
  },
  {
    id: "gutenberg-8438",
    title: "Nicomachean Ethics",
    author: "Aristotle",
    description: "What the good life is and how virtue is habituated.",
    gutenbergId: 8438,
  },
  {
    id: "gutenberg-1998",
    title: "Thus Spake Zarathustra",
    author: "Friedrich Nietzsche",
    description: "The Übermensch, eternal recurrence, and the death of God.",
    gutenbergId: 1998,
  },
  {
    id: "gutenberg-3300",
    title: "The Wealth of Nations",
    author: "Adam Smith",
    description: "The founding text of modern economics.",
    gutenbergId: 3300,
  },
  {
    id: "gutenberg-2009",
    title: "On the Origin of Species",
    author: "Charles Darwin",
    description: "Evolution by natural selection, in Darwin's own words.",
    gutenbergId: 2009,
  },
  {
    id: "gutenberg-132",
    title: "The Art of War",
    author: "Sun Tzu",
    description: "The ancient Chinese treatise on strategy and conflict.",
    gutenbergId: 132,
  },
  {
    id: "gutenberg-1232",
    title: "The Prince",
    author: "Niccolò Machiavelli",
    description: "The unsentimental handbook of political power.",
    gutenbergId: 1232,
  },
  {
    id: "gutenberg-205",
    title: "Walden",
    author: "Henry David Thoreau",
    description: "Two years in the woods, on living deliberately.",
    gutenbergId: 205,
  },
  {
    id: "gutenberg-34901",
    title: "On Liberty",
    author: "John Stuart Mill",
    description: "The limits of society's power over the individual.",
    gutenbergId: 34901,
  },
  {
    id: "gutenberg-3420",
    title: "A Vindication of the Rights of Woman",
    author: "Mary Wollstonecraft",
    description: "The foundational argument for women's education and equality.",
    gutenbergId: 3420,
  },
  {
    id: "gutenberg-1080",
    title: "A Modest Proposal",
    author: "Jonathan Swift",
    description: "The most savage satire ever written about poverty.",
    gutenbergId: 1080,
  },
];

export function getCatalogBook(id: string): CatalogBook | undefined {
  return CATALOG.find((b) => b.id === id);
}

/** Gutenberg's content-negotiated EPUB3 download link (verified stable). */
export function gutenbergEpubUrl(gutenbergId: number): string {
  return `https://www.gutenberg.org/ebooks/${gutenbergId}.epub3.images`;
}
