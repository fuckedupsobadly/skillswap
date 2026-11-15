import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const jitsi = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si";

// Strict-but-workable CSP: Next.js needs inline bootstrap scripts; video rooms are framed from Jitsi.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  `frame-src https://${jitsi}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "pg"],
  // Every place has one name now (§9 twin pages); older links keep working.
  async redirects() {
    const r = (source: string, destination: string) => ({ source, destination, permanent: true });
    return [
      r("/wallet", "/bank"),
      r("/wallet/:id", "/bank/:id"),
      r("/audit", "/tower"),
      r("/settings", "/hall"),
      r("/match", "/tavern"),
      r("/requests/new", "/well"),
      r("/concierge", "/tavern/barkeep"),
      r("/onboarding", "/gate"),
      r("/explore", "/board"),
      r("/explore/:category", "/board"),
      r("/kitty/adopt", "/gate/kitty"),
      r("/profile", "/hut"),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The Lantern Room frames the video call, so the call's origin may use the camera and microphone too.
          {
            key: "Permissions-Policy",
            value: `camera=(self "https://${jitsi}"), microphone=(self "https://${jitsi}"), display-capture=(self "https://${jitsi}"), geolocation=(self)`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
