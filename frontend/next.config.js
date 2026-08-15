/** @type {import('next').NextConfig} */
module.exports = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.r2.dev' }],
  },
  async redirects() {
    return [{ source: '/home', destination: '/discover', permanent: false }];
  },
};
