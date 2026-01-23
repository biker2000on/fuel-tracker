# Phase 14: Fix PWA Install - Research

**Researched:** 2026-01-22
**Domain:** PWA Installation, Next.js, Serwist, iOS Compatibility
**Confidence:** HIGH

## Summary

The current PWA implementation relies solely on the `beforeinstallprompt` event, which is not supported by iOS Safari and some other browsers. This results in the "Add to Home Screen" button being completely hidden for a significant portion of users. Additionally, the web app manifest is missing modern fields required for "Rich Install UI" on Android/Chrome.

**Primary recommendation:** Implement a two-tiered install strategy: use `beforeinstallprompt` for supported browsers and a custom "Instructional UI" for iOS/Safari users, while enhancing the manifest to meet modern "Rich Install" criteria.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Serwist | Latest | Service Worker & PWA | Modern successor to `next-pwa`, supports Next.js 15+ App Router. |
| Next.js | 15/16 | Metadata API | Provides native `manifest.ts` support for dynamic manifests. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | Latest | Icons | For "Share" and "Add to Home Screen" icons in iOS instructions. |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/
│   └── useInstallPrompt.ts  # Updated to detect iOS and platform support
├── components/
│   ├── InstallButton.tsx    # Multi-platform install button
│   └── IOSInstallGuide.tsx  # New component for iOS manual instructions
└── app/
    ├── manifest.ts         # Enhanced manifest with screenshots/id
    └── layout.tsx          # apple-touch-icon and splash screen links
```

### Pattern 1: Platform-Aware Install Logic
**What:** Distinguish between "Direct Install" (Chrome/Android) and "Manual Install" (iOS).
**When to use:** In the `useInstallPrompt` hook to provide accurate state to the UI.
**Example:**
```typescript
// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
// Detect if already installed
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
// State for supported prompt
const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

return {
  isIOS,
  isStandalone,
  canInstall: (deferredPrompt !== null || (isIOS && !isStandalone)),
  platform: isIOS ? 'ios' : 'standard',
  // ...
};
```

### Anti-Patterns to Avoid
- **Hiding UI on iOS:** Don't just return `null` if `beforeinstallprompt` is missing; iOS users need to be told how to install.
- **Immediate Prompting:** Don't trigger or show install buttons immediately on page load; wait for user engagement to increase acceptance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PWA Manifest | Manual JSON file | `manifest.ts` | Next.js Metadata API handles caching and dynamic fields better. |
| Offline Caching | Manual Fetch listeners | Serwist | Handles edge cases, range requests (for videos/audio), and precaching automatically. |

## Common Pitfalls

### Pitfall 1: Missing "Rich Install UI" Criteria
**What goes wrong:** Chrome shows a generic, small install dialog instead of the large, app-store-like prompt.
**Why it happens:** Missing `screenshots` or `description` in `manifest.json`.
**How to avoid:** Add at least one desktop and one mobile screenshot to the manifest.

### Pitfall 2: iOS Icon & Splash Screen Inconsistency
**What goes wrong:** PWA icon looks wrong or splash screen is just white on iOS.
**Why it happens:** iOS often ignores the manifest icons for the home screen if `apple-touch-icon` is missing in `<head>`. Splash screens require specific meta tags.
**How to avoid:** Add `apple-touch-icon` and `apple-touch-startup-image` tags to the Root Layout metadata.

## Code Examples

### Enhanced `manifest.ts`
```typescript
// Source: https://developer.chrome.com/docs/capabilities/pwa/rich-install-ui
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: 'fuel-tracker-pwa',
    name: 'Fuel Tracker',
    short_name: 'Fuel',
    description: 'Track fuel consumption and vehicle efficiency across your family fleet.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
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
    screenshots: [
      {
        src: '/screenshots/mobile-dashboard.png',
        sizes: '1170x2532',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Fuel Tracker Dashboard',
      },
      {
        src: '/screenshots/desktop-history.png',
        sizes: '2880x1800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Vehicle History and Analytics',
      },
    ],
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `manifest.json` | `manifest.ts` | Next.js 13.4+ | Better integration with Next.js environment variables and dynamic logic. |
| `apple-mobile-web-app-capable` | `display: standalone` | 2023+ | Most browsers now respect the manifest over meta tags, but iOS still benefits from both. |
| Single icon | Maskable icons | 2021+ | Icons look native on all Android launchers (no white circles). |

## Open Questions

1. **Screenshot generation:** Do we have existing design assets for the screenshots, or do we need to capture them during development?
   - *Recommendation:* Capture real app screenshots once the UI is stable in Phase 14.
2. **iOS non-Safari installation:** Does the app correctly detect installation from Chrome on iOS (now supported since iOS 16.4)?
   - *What we know:* It should, as long as we use the `display-mode: standalone` check.

## Sources

### Primary (HIGH confidence)
- [Official Serwist Docs](https://serwist.pages.dev/docs/next/getting-started) - Next.js integration.
- [web.dev - PWA Install Criteria](https://web.dev/articles/install-criteria) - Manifest requirements.
- [Developer Chrome - Rich Install UI](https://developer.chrome.com/docs/capabilities/pwa/rich-install-ui) - Screenshots requirement.

### Secondary (MEDIUM confidence)
- [Firt.dev - iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/) - Comprehensive iOS support list (updated 2023-2024).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Serwist is the clear choice for Next.js.
- Architecture: HIGH - Two-tiered prompt strategy is industry standard.
- Pitfalls: HIGH - Common issues with iOS and Rich UI are well-documented.

**Research date:** 2026-01-22
**Valid until:** 2026-07-22
