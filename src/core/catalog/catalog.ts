/**
 * A small, curated catalog of public-domain "hard books" sourced from
 * Project Gutenberg. Users add these to their library with one click; the
 * import route downloads the EPUB and runs it through the normal ingestion
 * pipeline. All titles are verified reachable and parse cleanly.
 */

export type CatalogSubject = "Philosophy" | "Science & Technology" | "Politics & Economics";

/** Order subjects appear in on the shelf. */
export const CATALOG_SUBJECTS: CatalogSubject[] = [
  "Philosophy",
  "Science & Technology",
  "Politics & Economics",
];

export interface CatalogBook {
  /** Stable catalog id, e.g. "gutenberg-1497". */
  id: string;
  title: string;
  author: string;
  /** One-line pitch shown on the card. */
  description: string;
  subject: CatalogSubject;
  gutenbergId: number;
}

export const CATALOG_SOURCE = "Project Gutenberg";

export const CATALOG: CatalogBook[] = [
  // --- Philosophy ---
  {
    id: "gutenberg-1497",
    title: "The Republic",
    author: "Plato",
    description: "Justice, the ideal city, and the allegory of the cave.",
    subject: "Philosophy",
    gutenbergId: 1497,
  },
  {
    id: "gutenberg-2680",
    title: "Meditations",
    author: "Marcus Aurelius",
    description: "The private Stoic notebook of a Roman emperor.",
    subject: "Philosophy",
    gutenbergId: 2680,
  },
  {
    id: "gutenberg-8438",
    title: "Nicomachean Ethics",
    author: "Aristotle",
    description: "What the good life is and how virtue is habituated.",
    subject: "Philosophy",
    gutenbergId: 8438,
  },
  {
    id: "gutenberg-1998",
    title: "Thus Spake Zarathustra",
    author: "Friedrich Nietzsche",
    description: "The Übermensch, eternal recurrence, and the death of God.",
    subject: "Philosophy",
    gutenbergId: 1998,
  },
  {
    id: "gutenberg-205",
    title: "Walden",
    author: "Henry David Thoreau",
    description: "Two years in the woods, on living deliberately.",
    subject: "Philosophy",
    gutenbergId: 205,
  },

  // --- Science & Technology ---
  {
    id: "gutenberg-2009",
    title: "On the Origin of Species",
    author: "Charles Darwin",
    description: "Evolution by natural selection, in Darwin's own words.",
    subject: "Science & Technology",
    gutenbergId: 2009,
  },
  {
    id: "gutenberg-30155",
    title: "Relativity: The Special and General Theory",
    author: "Albert Einstein",
    description: "Einstein's own popular account of relativity.",
    subject: "Science & Technology",
    gutenbergId: 30155,
  },
  {
    id: "gutenberg-57532",
    title: "Passages from the Life of a Philosopher",
    author: "Charles Babbage",
    description: "The memoir of the man who designed the first computer.",
    subject: "Science & Technology",
    gutenbergId: 57532,
  },
  {
    id: "gutenberg-97",
    title: "Flatland",
    author: "Edwin A. Abbott",
    description: "A two-dimensional world's brush with higher dimensions.",
    subject: "Science & Technology",
    gutenbergId: 97,
  },
  {
    id: "gutenberg-33504",
    title: "Opticks",
    author: "Isaac Newton",
    description: "Newton's experiments on light, colour, and the spectrum.",
    subject: "Science & Technology",
    gutenbergId: 33504,
  },
  {
    id: "gutenberg-14474",
    title: "The Chemical History of a Candle",
    author: "Michael Faraday",
    description: "Faraday's classic lectures — a whole science in one flame.",
    subject: "Science & Technology",
    gutenbergId: 14474,
  },
  {
    id: "gutenberg-13476",
    title: "Experiments with Alternate Currents of High Potential and High Frequency",
    author: "Nikola Tesla",
    description: "Tesla's landmark lecture on high-frequency electricity.",
    subject: "Science & Technology",
    gutenbergId: 13476,
  },

  // --- Politics & Economics ---
  {
    id: "gutenberg-3300",
    title: "The Wealth of Nations",
    author: "Adam Smith",
    description: "The founding text of modern economics.",
    subject: "Politics & Economics",
    gutenbergId: 3300,
  },
  {
    id: "gutenberg-132",
    title: "The Art of War",
    author: "Sun Tzu",
    description: "The ancient Chinese treatise on strategy and conflict.",
    subject: "Politics & Economics",
    gutenbergId: 132,
  },
  {
    id: "gutenberg-1232",
    title: "The Prince",
    author: "Niccolò Machiavelli",
    description: "The unsentimental handbook of political power.",
    subject: "Politics & Economics",
    gutenbergId: 1232,
  },
  {
    id: "gutenberg-34901",
    title: "On Liberty",
    author: "John Stuart Mill",
    description: "The limits of society's power over the individual.",
    subject: "Politics & Economics",
    gutenbergId: 34901,
  },
  {
    id: "gutenberg-3420",
    title: "A Vindication of the Rights of Woman",
    author: "Mary Wollstonecraft",
    description: "The foundational argument for women's education and equality.",
    subject: "Politics & Economics",
    gutenbergId: 3420,
  },
  {
    id: "gutenberg-1080",
    title: "A Modest Proposal",
    author: "Jonathan Swift",
    description: "The most savage satire ever written about poverty.",
    subject: "Politics & Economics",
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
