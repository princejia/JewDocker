/**
 * 图片来源白名单。
 * 使用精确域名而非通配符：通配符会放大 GHSA-9g9p-9gw9-jx7f
 * （自托管 Image Optimizer 被任意来源图片拖垮）的风险面。
 */
function imageHosts() {
  const hosts = new Set();
  if (process.env.COS_PUBLIC_BASE_URL) {
    hosts.add(new URL(process.env.COS_PUBLIC_BASE_URL).hostname);
  }
  if (process.env.COS_BUCKET && process.env.COS_REGION) {
    hosts.add(
      `${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`
    );
  }
  return [...hosts].map((hostname) => ({ protocol: "https", hostname }));
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 产出自包含的 server.js，Docker 镜像无需携带完整 node_modules
  output: "standalone",
  images: {
    remotePatterns: imageHosts(),
    // 缓解 GHSA-3x4c-7xq6-9pq8：拉长 TTL 减少重复回源与缓存条目数
    minimumCacheTTL: 2592000,
  },
};

export default nextConfig;
