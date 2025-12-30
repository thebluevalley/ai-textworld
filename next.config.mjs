/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开启 React 严格模式有助于发现问题
  reactStrictMode: true,
  
  // 如果你需要允许跨域图片（比如用户头像），可以在这里配置
  // images: {
  //   remotePatterns: [
  //     {
  //       protocol: 'https',
  //       hostname: 'example.com',
  //     },
  //   ],
  // },
};

export default nextConfig;