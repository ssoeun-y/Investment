/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        domains: ['example.com'],
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:8080/api/:path*',
            },
            {
                source: '/oauth2/:path*',
                destination: 'http://localhost:8080/oauth2/:path*',
            },
            {
                source: '/logout',
                destination: 'http://localhost:8080/logout',
            },
        ];
    },
}

module.exports = nextConfig
