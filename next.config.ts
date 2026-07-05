import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // El SDK z-ai-web-dev-sdk usa require() dinamico — mantenerlo server-side
  serverExternalPackages: ["z-ai-web-dev-sdk"],
  // Turbopack root fix para espacios en el path
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Webpack: evitar que modulos de Node.js rompan el bundle del cliente
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        "fs/promises": false,
        path: false,
        os: false,
        crypto: false,
      };
    }
    return config;
  },
  // Headers de seguridad basicos
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
