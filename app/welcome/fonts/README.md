# Fraunces, subset

`Fraunces-600-subset.ttf` is Fraunces at weight 600, cut down to only the
characters that appear in the link-preview image next door — 11 KB rather than
the ~300 KB of the whole face.

It is committed rather than fetched because the preview image is rendered at
build time, and `next/og` cannot render without a font at all: a font server
having a bad afternoon would otherwise fail the deployment. That is not a
hypothetical — it was tested by pointing the fetch at a host that does not
resolve, and the build died with `Cannot read properties of undefined`.

Regenerate it by asking Google Fonts for exactly the characters in use:

    https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&text=<the+characters>

sent with a browser `User-Agent` (the API serves woff2 to anything modern, and
satori wants TrueType). Follow the `src: url(...)` in the reply.

Copyright 2018 The Fraunces Project Authors, under the SIL Open Font License
1.1 — see `OFL.txt`. The licence permits this redistribution; it travels with
the font.
