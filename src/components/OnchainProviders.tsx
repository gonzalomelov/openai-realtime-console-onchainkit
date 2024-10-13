'use client';

import { RainbowKitProvider, getDefaultWallets, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { NEXT_PUBLIC_CDP_API_KEY } from '../config';

const queryClient = new QueryClient();

const projectId = 'YOUR_PROJECT_ID'; // Replace with your actual WalletConnect project ID

const { wallets } = getDefaultWallets({
  appName: 'OpenAI Realtime Console with OnchainKit',
  projectId,
});

const connectors = connectorsForWallets([
  ...wallets,
  // You can add more wallet connectors here if needed
], {
  appName: 'OpenAI Realtime Console with OnchainKit',
  projectId,
});

const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
  connectors,
  ssr: true,
});

function OnchainProviders({ children }: { children: React.ReactNode }) {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Check if the app is running as a PWA
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
    console.log('Is PWA:', isPWA);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={config.chains}
          modalSize="compact"
          mode={isPWA ? 'redirect' : 'auto'}
        >
          <OnchainKitProvider apiKey={NEXT_PUBLIC_CDP_API_KEY} chain={baseSepolia}>
            {children}
          </OnchainKitProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default OnchainProviders;
