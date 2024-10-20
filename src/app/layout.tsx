import type { Metadata } from 'next';
import { NEXT_PUBLIC_URL } from '../config';

import './globals.css'
import '@coinbase/onchainkit/styles.css';
import '@rainbow-me/rainbowkit/styles.css';
import dynamic from 'next/dynamic';

const OnchainProviders = dynamic(
  () => import('../components/OnchainProviders'),
  {
    ssr: false,
  },
);

export const metadata: Metadata = {
  title: 'OpenAI Realtime Console with OnchainKit',
  description: 'OpenAI Realtime Console integrated with OnchainKit',
  openGraph: {
    title: 'OpenAI Realtime Console with OnchainKit',
    description: 'OpenAI Realtime Console integrated with OnchainKit',
    images: [`${NEXT_PUBLIC_URL}/vibes/vibes-19.png`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap"
          rel="stylesheet"
        />
        {/* <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.6.0/dist/leaflet.css"
          integrity="sha512-xwE/Az9zrjBIphAcBb3F6JVqxf46+CDLwfLMHloNu6KEQCAWi6HcDUbeOfBIptF7tcCzusKFjFw2yuvEpDL9wQ=="
          crossOrigin=""
        />
        <script
          src="https://unpkg.com/leaflet@1.6.0/dist/leaflet.js"
          integrity="sha512-gZwIG9x3wUXg2hdXF6+rVkLF/0Vi9U8D2Ntg4Ga5I5BZpVkVxlJWbSQtXPSiUTtC0TjtGOmxa1AJPuV0CPthew=="
          crossOrigin=""
        ></script> */}
      </head>
      <body>
        {/* {children} */}
        <OnchainProviders>{children}</OnchainProviders>
      </body>
    </html>
  )
}
