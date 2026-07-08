/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist (used server-side for metadata) must not be bundled by Next.
  serverExternalPackages: ["pdfjs-dist"],
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
