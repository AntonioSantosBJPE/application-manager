import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import tokensCss from '@am/ui/styles/tokens.css?url';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Rumo Carreira' },
    ],
    // The theme follows prefers-color-scheme in tokens.css only; the app never sets data-theme.
    // The favicon swaps its own color with prefers-color-scheme; both icons are served from public/ (PRU-05).
    // The app icon is a 180x180 PNG of rumo-app-icon.svg, the size and format iOS reads for apple-touch-icon.
    links: [
      { rel: 'stylesheet', href: tokensCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', type: 'image/png', sizes: '180x180', href: '/app-icon.png' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
