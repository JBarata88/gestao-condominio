import type { NextConfig } from "next";

import { version } from "./package.json";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "unpdf"],
  // A versão da aplicação vem do package.json e fica disponível no cliente
  // (rodapé da navegação) sem precisar de a repetir noutro sítio.
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
