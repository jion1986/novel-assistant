/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // 图片优化（使用外部图片时）
  images: {
    unoptimized: true,
  },

  // 环境变量在构建时注入
  env: {
    NEXT_PUBLIC_APP_NAME: 'AI 小说助手',
  },
}

export default nextConfig
