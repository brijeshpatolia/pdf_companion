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
below.

## Where it stands

Measured 2026-08-01, `bge-small-en-v1.5`, 1800-char pages, fp32, query prefix
applied — i.e. what production does:

| k | hit rate | recall |
|---|---|---|
| 1 | 50.0% | 48.7% |
| 3 | 67.3% | 66.0% |
| 5 | 75.0% | 73.7% |
| 10 | 78.8% | 78.8% |

MRR **0.601**. Misses at k=5: **13 of 52**.

Before the model swap, on `all-MiniLM-L6-v2`: hit@1 30.8%, hit@5 51.9%, MRR
0.393, and 28 of 52 missed. Roughly half the failures went away.

No page here exceeds the model's 512-token context (longest 434), because EPUB
pages are capped at 1800 characters. A **PDF** page is whatever length the PDF
has, and that case is not covered by this corpus.

## The embedding stability scare

`embedding.eval.ts` exists because the retrieval eval once refused to give the
same answer twice — hit@1 moving six points between identical runs. int8
embeddings were caught coming back at cosine 0.237, at 0.14, and once with 15
of 36 comparisons drifting. Those were real measurements.

**They have not reproduced since** — several hundred comparisons, vitest and
plain node, q8 and fp32, with and without other work interleaved. Every
observation came from a window when large models were also being downloaded and
loaded, which points at memory pressure rather than quantization as such. That
is a hypothesis, not a finding, and an intermittent fault that cannot be
reproduced also cannot be verified fixed.

So the test now measures and reports rather than asserting a fault. An earlier
version asserted that q8 *must* drift, which inverted the point of a test: it
went red the moment the thing it watched started behaving. Current reading is
0/36 at both precisions.

If it returns, what is at stake: a page embedded on a bad pass is stored with a
vector that means nothing and is unfindable for the life of the book — no
error, no retry, nothing to see.

## What the sweep says to do

Same 52 questions, fp32, at the production page size. `npm run eval:sweep`
(set `EVAL_PAGE_SIZES` to sweep pagination too):

| model | hit@1 | hit@5 | hit@10 | MRR | weights |
|---|---|---|---|---|---|
| all-MiniLM-L6-v2 | 30.8% | 51.9% | 57.7% | 0.393 | 23 MB |
| **bge-small-en-v1.5** | **50.0%** | **75.0%** | **78.8%** | **0.601** | **32 MB** |
| Qwen3-Embedding-0.6B (→384) | 51.9% | 84.6% | 90.4% | 0.655 | 585 MB |

`bge-small-en-v1.5` ships. It is 384-dimensional, so `chunks.embedding
vector(384)` was untouched.

**Qwen3-Embedding-0.6B is the better model and cannot be used here.** It wins
clearly at k=5 and k=10 even truncated to 384 dimensions via Matryoshka — but
it is 585 MB against bge-small's 32, and embedding runs *inside* the serverless
function, so that is downloaded on every cold start into a 60-second budget
shared with the work itself. It becomes viable only by moving embedding out of
the request path, which is a different architecture rather than a config
change. The numbers above are what would justify that work.

One caution about that row, because it nearly went the other way: Qwen3 is a
decoder and needs **last-token** pooling. Mean-pooled — correct for the two
encoders — it scored 21.2% hit@1, *below MiniLM*. The first version of this
table said exactly that, and it was an artefact of the harness, not a property
of the model.

Smaller pages are not the answer they look like — they help MiniLM slightly,
hurt BGE, and changing page size renumbers every page, which would invalidate
stored reading progress and every saved highlight.

## Adding questions

Read the page first. A label that was guessed is worse than no label, because
it moves the number without telling the truth.
