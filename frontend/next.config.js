/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        domains: ['example.com'], // 이미지 도메인 추가
    },
}

module.exports = nextConfig
