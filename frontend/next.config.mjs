/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The invitation token is a bearer credential carried in the PATH of
        // /invite/<token>. Without this, the browser leaks the full URL (token
        // included) in the Referer header to any cross-origin subresource
        // (analytics, fonts, pixels) or outbound link click. `no-referrer`
        // strips the Referer entirely for requests originating from this page.
        // Path-layer log redaction is the complementary control — see
        // ".ai/workflows/deploy-flow.md" → "Observabilidade e Segredos em Logs"
        // (follow-up R10).
        source: '/invite/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
