/**
 * The questions, and the pages that answer them.
 *
 * Hand-labelled against the corpus in `__fixtures__/meditations.txt` — the
 * Casaubon translation of Marcus Aurelius, Books I–VII, paginated by the app's
 * own paginator so the pages here are the pages production would store.
 *
 * Two rules were followed in writing these, and both matter for whether the
 * number this produces means anything:
 *
 * **They are asked the way a reader asks.** Modern English, no borrowed
 * vocabulary. It would be easy — and worthless — to write "what is said of
 * adventitious imaginations?" and watch the retriever score perfectly on
 * lexical overlap. The real task this app performs is matching a plain
 * question against seventeenth-century prose, so that is the task measured.
 *
 * **The labels come from reading the pages, not from guessing.** Every entry
 * was checked against the text at that page number.
 *
 * `pages` is a set, not a single answer: some subjects genuinely run across a
 * page break, and the paginator splits mid-passage. Where a question is
 * answered on one page and continued on the next, both are listed — retrieving
 * either is a success.
 */

export interface Golden {
  question: string;
  /** 1-based page numbers, as the app would number them. */
  pages: number[];
  /** Roughly where in the book the answer sits — used to break down results. */
  book: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export const GOLDENS: Golden[] = [
  // ---- Book I: the debts he owes to particular people ----
  { question: "What did Marcus Aurelius learn from his grandfather?", pages: [1], book: 1 },
  { question: "What did he learn from Diognetus?", pages: [2], book: 1 },
  { question: "Who first made him think his life needed correcting?", pages: [3], book: 1 },
  { question: "What did Apollonius teach him about enduring pain and loss?", pages: [4], book: 1 },
  { question: "What qualities did he admire in Sextus?", pages: [5], book: 1 },
  {
    question: "Who taught him not to excuse himself by saying he was too busy?",
    pages: [6],
    book: 1,
  },
  { question: "What does he say he admired about his adoptive father?", pages: [8, 9, 10], book: 1 },
  { question: "Was his father superstitious, or eager for popular approval?", pages: [9], book: 1 },
  { question: "What is he grateful to the gods for?", pages: [11], book: 1 },

  // ---- Book II ----
  {
    question: "How should I prepare myself in the morning for meeting difficult people?",
    pages: [14],
    book: 2,
  },
  { question: "What are the three things he says a person is made of?", pages: [15], book: 2 },
  { question: "How long have I been putting off becoming who I should be?", pages: [17], book: 2 },
  {
    question: "Are sins committed out of anger worse than sins committed out of desire?",
    pages: [19],
    book: 2,
  },
  { question: "Should I act as though today could be my last day?", pages: [20], book: 2 },
  {
    question: "How much of their life does a person actually lose when they die?",
    pages: [23],
    book: 2,
  },
  { question: "What does he mean when he says everything is opinion?", pages: [24], book: 2 },
  { question: "What does he compare the length of a human life to?", pages: [25], book: 2 },

  // ---- Book III ----
  {
    question: "Hippocrates cured many people and then died himself — what is the point of that?",
    pages: [29],
    book: 3,
  },
  {
    question: "Should I spend my time wondering what other people are thinking of me?",
    pages: [30],
    book: 3,
  },
  { question: "What does he say about using elaborate or ornate language?", pages: [32], book: 3 },
  {
    question: "What should I do if I find something better than justice and truth?",
    pages: [33],
    book: 3,
  },
  {
    question: "Why should I never call something useful if it costs me my honesty?",
    pages: [35],
    book: 3,
  },

  // ---- Book IV ----
  {
    question: "Where should a person go to find peace and quiet?",
    pages: [42],
    book: 4,
  },
  {
    question: "If reason is shared by everyone, what follows about how we should live together?",
    pages: [45],
    book: 4,
  },
  { question: "What happens if I stop believing I have been wronged?", pages: [46], book: 4 },
  { question: "Why is wanting to be remembered after death pointless?", pages: [48], book: 4 },
  { question: "Does he think the soul survives after the body dies?", pages: [49], book: 4 },
  {
    question: "What does looking at the reign of Vespasian teach about human affairs?",
    pages: [53],
    book: 4,
  },
  { question: "What does he notice about words falling out of use?", pages: [54], book: 4 },
  {
    question: "If a god told me I would die tomorrow, should that change anything?",
    pages: [58],
    book: 4,
  },
  {
    question: "What should I remember about doctors who outlived their patients?",
    pages: [59],
    book: 4,
  },
  {
    question: "Instead of calling myself unlucky when something bad happens, what should I say?",
    pages: [60],
    book: 4,
  },

  // ---- Book V ----
  { question: "How do I argue myself out of bed in the morning?", pages: [63], book: 5 },
  {
    question: "Do bees and ants do their work more willingly than I do mine?",
    pages: [63],
    book: 5,
  },
  {
    question: "Should I expect something back when I do someone a favour?",
    pages: [67],
    book: 5,
  },
  { question: "What was the Athenians' prayer for rain?", pages: [69], book: 5 },
  {
    question: "If I keep failing to live up to my own principles, should I give up?",
    pages: [72],
    book: 5,
  },
  { question: "How do my habitual thoughts colour my mind over time?", pages: [78], book: 5 },
  {
    question: "Is it foolish to be surprised when a bad person behaves badly?",
    pages: [79],
    book: 5,
  },
  {
    question: "If something does not damage the community, can it really damage me?",
    pages: [81],
    book: 5,
  },
  { question: "What will be left of me in a short while?", pages: [86], book: 5 },

  // ---- Book VI ----
  { question: "What does he do if someone proves him wrong?", pages: [96], book: 6 },
  {
    question: "How should I behave as someone who learned from Antoninus Pius?",
    pages: [99],
    book: 6,
  },
  {
    question: "What can I learn from craftsmen who stick to their trade?",
    pages: [101],
    book: 6,
  },
  {
    question: "How should I think about the good qualities of the people around me?",
    pages: [109],
    book: 6,
  },

  // ---- Book VII ----
  { question: "Is it reasonable to be afraid of change?", pages: [118], book: 7 },
  {
    question: "What is the image of the universe shaping matter like wax?",
    pages: [120],
    book: 7,
  },
  {
    question: "When somebody wrongs me, what should I work out about them first?",
    pages: [121],
    book: 7,
  },
  {
    question: "What does Plato say about whether a worthy man should fear death?",
    pages: [125],
    book: 7,
  },
  {
    question: "What do human affairs look like from a great height?",
    pages: [126],
    book: 7,
  },
  { question: "How should I think about pain I cannot avoid?", pages: [132], book: 7 },
  { question: "Can a person be genuinely great and completely unknown?", pages: [134], book: 7 },
];
