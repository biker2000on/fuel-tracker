import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, NetworkFirst, NetworkOnly, ExpirationPlugin } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Custom runtime caching rules for offline-first
const runtimeCaching = [
  // Static assets (JS, CSS, fonts) - CacheFirst with long TTL
  {
    matcher: ({ request }: { request: Request }) => {
      const destination = request.destination;
      return destination === "script" || destination === "style" || destination === "font";
    },
    handler: new CacheFirst({
      cacheName: "static-assets",
    }),
  },
  // Images - CacheFirst
  {
    matcher: ({ request }: { request: Request }) => request.destination === "image",
    handler: new CacheFirst({
      cacheName: "images",
    }),
  },
  // Session check - NetworkFirst so useSession() resolves while offline
  // instead of treating the user as unauthenticated.
  {
    matcher: ({ request, url }: { request: Request; url: URL }) => {
      return request.method === "GET" && url.pathname === "/api/auth/session";
    },
    handler: new NetworkFirst({
      cacheName: "api-auth-session",
      networkTimeoutSeconds: 3,
    }),
  },
  // All other auth endpoints (csrf, signin, callback, providers) must never
  // be served from cache.
  {
    matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/api/auth/"),
    handler: new NetworkOnly(),
  },
  // API mutations - NetworkOnly (handled by offline queue in app)
  {
    matcher: ({ request, url }: { request: Request; url: URL }) => {
      return url.pathname.startsWith("/api/") && request.method !== "GET";
    },
    handler: new NetworkOnly(),
  },
  // All remaining API GETs (vehicles, dashboard, fillups, analytics, stats,
  // profile, groups, ...) - NetworkFirst so every screen has offline data.
  {
    matcher: ({ request, url }: { request: Request; url: URL }) => {
      return request.method === "GET" && url.pathname.startsWith("/api/");
    },
    handler: new NetworkFirst({
      cacheName: "api-get",
      networkTimeoutSeconds: 4,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    }),
  },
  // Page navigations - NetworkFirst so previously visited pages keep working
  // offline; the /~offline fallback only kicks in for never-visited pages.
  {
    matcher: ({ request }: { request: Request }) => request.destination === "document",
    handler: new NetworkFirst({
      cacheName: "pages",
      networkTimeoutSeconds: 4,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    }),
  },
  // Include default cache for other requests (RSC payloads, etc.)
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
