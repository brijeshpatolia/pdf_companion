/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist (used server-side for metadata) must not be bundled by Next.
  serverExternalPackages: ["pdfjs-dist", "@huggingface/transformers"],
  // Because pdfjs-dist stays external, its files are copied into the serverless
  // bundle by output-file tracing — but pdf.mjs loads its worker through a
  // runtime path the tracer can't see, so the worker is left behind and PDF
  // parsing dies with "Setting up fake worker failed" in production.
  //
  // Applied to every API route rather than the handful that parse PDFs today:
  // the dependency is transitive (e.g. /api/chat only reaches pdfjs via
  // supabasePageText), so an explicit list silently rots as imports move.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  webpack: (config) => {
    // react-pdf's pdfjs references an optional Node 'canvas' dep we don't use.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    // Source uses NodeNext-style ".js" specifiers that point at ".ts" files;
    // let webpack resolve them the way esbuild/Vitest already do.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
