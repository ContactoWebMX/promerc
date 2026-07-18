import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida mínima autocontenida para desplegar en cPanel (Setup Node.js App)
  // sin instalar node_modules completo en el servidor.
  output: "standalone",
  experimental: {
    serverActions: {
      // Fotos de cámara (ticket de báscula, firmas) van en el mismo body.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
