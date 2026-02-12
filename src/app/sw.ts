import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, NetworkFirst, NetworkOnly } from "serwist";

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
  // API GET - Vehicles list (cache for quick offline access)
  {
    matcher: ({ request, url }: { request: Request; url: URL }) => {
      return request.method === "GET" && url.pathname === "/api/vehicles";
    },
    handler: new NetworkFirst({
      cacheName: "api-vehicles",
      networkTimeoutSeconds: 3,
    }),
  },
  // API GET - Dashboard (NetworkFirst, stale data acceptable briefly)
  {
    matcher: ({ request, url }: { request: Request; url: URL }) => {
      return request.method === "GET" && url.pathname === "/api/dashboard";
    },
    handler: new NetworkFirst({
      cacheName: "api-dashboard",
      networkTimeoutSeconds: 3,
    }),
  },
  // API GET - Fillups list (NetworkFirst for fetching history)
  {
    matcher: ({ request, url }: { request: Request; url: URL }) => {
      return request.method === "GET" && url.pathname.startsWith("/api/fillups");
    },
    handler: new NetworkFirst({
      cacheName: "api-fillups",
      networkTimeoutSeconds: 3,
    }),
  },
  // API GET - Analytics (NetworkFirst, acceptable to show slightly stale data)
  {
    matcher: ({ request, url }: { request: Request; url: URL }) => {
      return request.method === "GET" && url.pathname === "/api/analytics";
    },
    handler: new NetworkFirst({
      cacheName: "api-analytics",
      networkTimeoutSeconds: 5,
    }),
  },
  // API POST/PUT/DELETE - NetworkOnly (handled by offline queue in app)
  {
    matcher: ({ request }: { request: Request }) => {
      return (
        request.url.includes("/api/") &&
        (request.method === "POST" || request.method === "PUT" || request.method === "DELETE")
      );
    },
    handler: new NetworkOnly(),
  },
  // Include default cache for other requests
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
