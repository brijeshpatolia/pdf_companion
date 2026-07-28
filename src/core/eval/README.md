# Retrieval eval

Until this existed, "is retrieval any good?" had no answer — every change to
pagination or the embedding model was made on the strength of an anecdote.

```
npm run eval          # the number, and the questions it gets wrong
npm run eval:sweep    # model × page-size comparison (slow)
```

Kept out of `npm test`: these download model weights and embed a whole book, so
they need the network and a minute. A deploy should not be able to fail because
Hugging Face is having a bad afternoon.

## What it measures

52 hand-labelled questions against Marcus Aurelius' *Meditations*, Books I–VII
— 137 pages, paginated by the app's own `paginateChapters`, so the pages scored
here are the pages production would store.

The questions are written **the way a reader asks**: plain modern English, no
vocabulary borrowed from the text. Writing "what is said of adventitious
imaginations?" would score wonderfully and measure nothing; the real task is
matching a plain question against seventeenth-century prose, so that is the
task measured. Labels come from reading the pages, not from guessing.

This measures the embeddings and the pagination, not pgvector. The difference
cuts both ways and is worth stating: ivfflat is an approximate index, so live
recall can only be equal to or worse than this, while the `max_page` spoiler
filter shrinks the candidate set, which can only help. Treat it as a ceiling,
measured exactly.

It runs at **fp32**, while production ships **q8** — see the stability section
below for why, which is the most important thing on this page.

## Where it stands

Measured 2026-07-28, `all-MiniLM-L6-v2`, 1800-char pages, fp32:

| k | hit rate | recall |
|---|---|---|
| 1 | 30.8% | 30.8% |
| 3 | 42.3% | 41.0% |
| 5 | 51.9% | 50.6% |
| 10 | 57.7% | 57.7% |

MRR **0.393**. At the `k=5` the chat actually uses, the page that answers the
question is missing **about half the time**.

Two things are visible in the failures. The same handful of pages (1, 4, 7, 91,
111) come back for unrelated questions, which is what an embedding keyed on
register rather than content looks like — and this corpus is uniformly
aphoristic, so register is nearly constant. And no page exceeds the model's
512-token context here (longest 434), because EPUB pages are capped at 1800
characters; a **PDF** page is whatever length the PDF has, and that case is not
covered by this corpus.

## The embedding is not stable — `npm run eval` found a bug

`embedding.eval.ts`. The same text, embedded twice, does not reliably produce
the same vector. One run, 36 comparisons per precision:

| precision | median | worst | not identical | < 0.99 | < 0.9 |
|---|---|---|---|---|---|
| q8 (ships) | 1.0000 | 0.7545 | 15/36 | 15 | 2 |
| fp32 | 1.0000 | 1.0000 | 0/36 | 0 | 0 |

So it is usually right — the median is exact — but roughly four in ten drift,
and a few per cent come back as a materially different vector. Severity varies
between runs: cosine between a page and *itself re-embedded* has been observed
as low as **0.14**.

It is the quantization. `localEmbedder` ships `dtype: "q8"` to fit a serverless
memory limit, and int8 inference in this stack is intermittently wrong — usually
the vector is right, occasionally it is barely related. At fp32 the same graph
is exact, every time, which is what makes this a bug rather than a complaint
about floating point.

The consequence in production is quiet and permanent: a page embedded on a bad
pass is stored with a vector that means nothing, and is then unfindable for the
life of the book. No error, no retry, nothing to see. A question embedded on a
bad pass simply retrieves the wrong pages once.

This is almost certainly dragging the numbers above down, and it was invisible
until an eval asked for the same answer twice.

## What the sweep says to do

Same 52 questions, fp32, judged by text overlap so page sizes are comparable:

| model | page chars | hit@1 | hit@5 | hit@10 | MRR |
|---|---|---|---|---|---|
| all-MiniLM-L6-v2 | 1800 | 30.8% | 51.9% | 57.7% | 0.393 |
| all-MiniLM-L6-v2 | 800 | 30.8% | 59.6% | 73.1% | 0.424 |
| **bge-small-en-v1.5** | **1800** | **50.0%** | **75.0%** | **78.8%** | **0.601** |
| bge-small-en-v1.5 | 800 | 40.4% | 67.3% | 75.0% | 0.522 |

The model is the lever, not the page size. `bge-small-en-v1.5` at the page size
already in use lifts hit@1 by 19 points and hit@5 by 23, and it is also
384-dimensional — so `chunks.embedding vector(384)` is unchanged and there is no
schema migration.

It is not free: embeddings from different models are not comparable, so
adopting it means **re-ingesting every book already in the system**. That is a
real operational cost and the reason the swap has not simply been made.

Smaller pages are not the answer they look like — they help MiniLM slightly,
hurt BGE, and changing page size renumbers every page, which would invalidate
stored reading progress and every saved highlight.

## Adding questions

Read the page first. A label that was guessed is worse than no label, because
it moves the number without telling the truth.
