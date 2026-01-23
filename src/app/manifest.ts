import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fuel Tracker',
    short_name: 'Fuel',
    id: '/',
    description: 'Track your vehicle fuel efficiency and costs with ease.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    screenshots: [
      {
        src: '/screenshots/mobile-dashboard.png',
        sizes: '1170x2532',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Dashboard on Mobile',
      },
      {
        src: '/screenshots/desktop-history.png',
        sizes: '2880x1800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'History on Desktop',
      },
    ],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
