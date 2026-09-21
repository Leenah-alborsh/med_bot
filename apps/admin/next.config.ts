import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@medical/shared'],
  // Next 15 does not reliably detect flat-config plugins; lint runs as a required workspace check.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
