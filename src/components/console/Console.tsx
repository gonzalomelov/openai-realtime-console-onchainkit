/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

const BACKEND: string =
  process.env.BACKEND || '';

import { useEffect, useRef, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image';

import { RealtimeClient } from '@openai/realtime-api-beta'
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js'
import { WavRecorder, WavStreamPlayer } from '@/lib/wavtools/index.js'
import { instructions } from '@/utils/conversation_config'
import { WavRenderer } from '@/utils/wav_renderer'

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather'
import { Button } from '@/components/button/Button'
import { Toggle } from '@/components/toggle/Toggle'

import '@/styles/components/Console.scss'

const Map = dynamic(() => import('@/components/map/Map'), { ssr: false })

import { isJsxOpeningLikeElement } from 'typescript';

/**
 * Type for result from get_weather() function call
 */
interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: {
    value: number;
    units: string;
  };
  wind_speed?: {
    value: number;
    units: string;
  };
}

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

function useRealtimeClient() {
  const [client, setClient] = useState<RealtimeClient | null>(null);

  useEffect(() => {
    /**
     * Ask user for API Key
     * If we're using the local relay server, we don't need this
     */
    const storedApiKey = LOCAL_RELAY_SERVER_URL
      ? ''
      : localStorage.getItem('tmp::voice_api_key') || '';
    
    if (storedApiKey !== '') {
      localStorage.setItem('tmp::voice_api_key', storedApiKey);
    }

    if (storedApiKey || LOCAL_RELAY_SERVER_URL) {
      const newClient = new RealtimeClient(
        LOCAL_RELAY_SERVER_URL
          ? { url: LOCAL_RELAY_SERVER_URL }
          : {
              apiKey: storedApiKey,
              dangerouslyAllowAPIKeyInBrowser: true,
            }
      );
      setClient(newClient);
    }

    return () => {
      if (client) {
        client.reset();
      }
    };
  }, []);

  const getClient = useCallback(() => {
    if (!client) {
      throw new Error('RealtimeClient not initialized');
    }
    return client;
  }, [client]);

  return { getClient, isReady: !!client };
}

import { useAccount, useBalance, useSendTransaction, useDisconnect } from 'wagmi';
import { parseEther } from 'viem';
import { getAddress } from '@coinbase/onchainkit/identity';
import { baseSepolia } from 'viem/chains';
import LoginButton from '../LoginButton';
import SignupButton from '../SignupButton';
import TransactionWrapper from '../TransactionWrapper';
import WalletWrapper from '../WalletWrapper';
import OnchainkitSvg from '@/svg/OnchainkitSvg';
import { ONCHAINKIT_LINK } from '@/links';
import TransferUsdcWrapper from '../TransferUsdcWrapper';
import ApproveUsdcWrapper from '../ApproveUsdcWrapper';

export function Console() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { sendTransaction } = useSendTransaction();
  const { disconnect } = useDisconnect();
  const { getClient, isReady } = useRealtimeClient();
  const [apiKey, setApiKey] = useState('');
  const [showBalance, setShowBalance] = useState(false);

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);

  const [lastAssistantMessage, setLastAssistantMessage] = useState<string>('...');
  const [lastUserMessage, setLastUserMessage] = useState<string>('...');

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  /**
   * When you click the API key
   */
  const resetAPIKey = useCallback(() => {
    const newApiKey = prompt('OpenAI API Key');
    if (newApiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', newApiKey);
      setApiKey(newApiKey);
      window.location.reload();
    }
  }, []);

  const reconnectClient = useCallback(async () => {
    if (!isReady) return;
    const client = getClient();
    if (!client.isConnected()) {
      await client.connect();
      // Reinitialize any necessary session parameters
      client.updateSession({ instructions: instructions });
      client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });
      // Add any other initialization steps here
    }
  }, [isReady, getClient]);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    await reconnectClient();
    const client = getClient();
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
        // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, [getClient, reconnectClient]);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setCoords({
      lat: 37.775593,
      lng: -122.418137,
    });
    setMarker(null);

    const client = getClient();
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, [getClient]);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = getClient();
    client.deleteItem(id);
  }, [getClient]);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = getClient();
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Attempt to reconnect if not connected
    if (!client.isConnected()) {
      try {
        await reconnectClient();
      } catch (error) {
        console.error('Failed to reconnect:', error);
        setIsRecording(false);
        // Optionally, show an error message to the user
        return;
      }
    }

    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = getClient();
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value: string) => {
    const client = getClient();
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const canvas = canvasRef.current;
    let ctx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded && canvas) {
        if (!canvas.width || !canvas.height) {
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
        }
        ctx = ctx || canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Render client visualization
          const clientResult = wavRecorder.recording
            ? wavRecorder.getFrequencies('voice')
            : { values: new Float32Array([0]) };
          WavRenderer.drawBars(
            canvas,
            ctx,
            clientResult.values,
            '#0099ff',
            10,
            0,
            4
          );

          // Render server visualization
          const serverResult = wavStreamPlayer.analyser
            ? wavStreamPlayer.getFrequencies('voice')
            : { values: new Float32Array([0]) };
          WavRenderer.drawBars(
            canvas,
            ctx,
            serverResult.values,
            '#009900',
            10,
            0,
            4
          );
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  const connectWallet = useCallback(async () => {
    if (address) {
      return { message: 'Wallet already connected', address };
    }
    const signupButton = document.querySelector('[data-testid="signup-button"] button');
    if (signupButton instanceof HTMLElement) {
      signupButton.click();
      return { message: 'Wallet connection initiated' };
    }
    return { message: 'Unable to initiate wallet connection' };
  }, [address]);

  const disconnectWallet = useCallback(async () => {
    if (!address) {
      return { message: 'No wallet connected' };
    }
    disconnect();
    return { message: 'Wallet disconnected' };
  }, [address, disconnect]);

  const approveUsdc = useCallback(async () => {
    if (!address) {
      return { message: 'No wallet connected' };
    }
    const approveUsdcButton = document.querySelector('[data-testid="approve-usdc-button"] button');
    if (approveUsdcButton instanceof HTMLElement) {
      approveUsdcButton.click();
      
      // Start a call after initiating USDC approval
      try {
        const response = await fetch(`https://${BACKEND}/call`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
          console.log('Call started successfully');
          return { message: 'USDC spending approved and call started successfully' };
        } else {
          console.error('Failed to start the call:', data.error);
          return { message: 'USDC spending approved but failed to start the call' };
        }
      } catch (error) {
        console.error('Error starting the call:', error);
        return { message: 'USDC spending approved but error occurred while starting the call' };
      }
    }
    return { message: 'Unable to initiate approve USDC spending' };
  }, [address]);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    if (!isReady) return;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = getClient();

    // Set instructions
    client.updateSession({ instructions: instructions });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    // Add tools
    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }: { [key: string]: any }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      }
    );
    client.addTool(
      {
        name: 'get_weather',
        description:
          'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
        parameters: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              description: 'Latitude',
            },
            lng: {
              type: 'number',
              description: 'Longitude',
            },
            location: {
              type: 'string',
              description: 'Name of the location',
            },
          },
          required: ['lat', 'lng', 'location'],
        },
      },
      async ({ lat, lng, location }: { [key: string]: any }) => {
        setMarker({ lat, lng, location });
        setCoords({ lat, lng, location });
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
        );
        const json = await result.json();
        const temperature = {
          value: json.current.temperature_2m as number,
          units: json.current_units.temperature_2m as string,
        };
        const wind_speed = {
          value: json.current.wind_speed_10m as number,
          units: json.current_units.wind_speed_10m as string,
        };
        setMarker({ lat, lng, location, temperature, wind_speed });
        return json;
      }
    );
    client.addTool(
      {
        name: 'send_eth',
        description: 'Sends a specified amount of ETH to a given address or Basename.',
        parameters: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'The recipient address or Basename (e.g., gonzalomelov.base.eth)',
            },
            amount: {
              type: 'string',
              description: 'The amount of ETH to send (in ETH, not Wei)',
            },
          },
          required: ['to', 'amount'],
        },
      },
      async ({ to, amount }: { to: string; amount: string }) => {
        if (!address) {
          return { error: 'No wallet connected' };
        }

        try {
          // Resolve Basename to address
          let recipientAddress = to;
          if (to.endsWith('.base.eth')) {
            const resolvedAddress = await getAddress({ name: to });
            if (resolvedAddress) {
              recipientAddress = resolvedAddress;
            } else {
              return { error: 'Unable to resolve Basename' };
            }
          }

          const amountInWei = parseEther(amount);
          const transaction = await sendTransaction({
            to: recipientAddress as `0x${string}`,
            value: amountInWei,
            chainId: baseSepolia.id,
          });
          
          return {
            message: `Transaction sent`, // : ${transaction.hash}
            // hash: transaction.hash,
          };
        } catch (error) {
          console.error('Error sending transaction:', error);
          return { error: 'Failed to send transaction' };
        }
      }
    );
    client.addTool(
      {
        name: 'get_account_balance',
        description: 'Retrieves the current account balance of the connected wallet.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async () => {
        if (!address) {
          return { error: 'No wallet connected' };
        }
        if (!balance) {
          return { error: 'Unable to fetch balance' };
        }
        setShowBalance(true); // Set showBalance to true when the tool is called
        return {
          address: address,
          balance: balance.formatted,
          symbol: balance.symbol,
        };
      }
    );
    client.addTool(
      {
        name: 'hide_account_balance',
        description: 'Hides the account balance display.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async () => {
        setShowBalance(false);
        return { message: 'Account balance hidden' };
      }
    );
    client.addTool(
      {
        name: 'connect_wallet',
        description: 'Connects or creates a wallet for the user.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async () => {
        await connectWallet();
        return { message: 'Wallet connection initiated' };
      }
    );
    client.addTool(
      {
        name: 'disconnect_wallet',
        description: 'Disconnects the currently connected wallet.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async () => {
        await disconnectWallet();
        return { message: 'Wallet disconnected' };
      }
    );
    client.addTool(
      {
        name: 'swap_usdc_for_ars',
        description: 'Swaps USDC for ARS using the connected wallet and calls the financial institution to negotiate the best rate and close the deal.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async () => {
        const result = await approveUsdc();
        return result;
      }
    );

    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);

      // Update last messages
      const assistantMessages = items.filter(i => i.role === 'assistant');
      const userMessages = items.filter(i => i.role === 'user');
      if (assistantMessages.length > 0) {
        const lastAssistantItem = assistantMessages[assistantMessages.length - 1];
        setLastAssistantMessage(lastAssistantItem.formatted.transcript || lastAssistantItem.formatted.text || '');
      }
      if (userMessages.length > 0) {
        const lastUserItem = userMessages[userMessages.length - 1];
        setLastUserMessage(lastUserItem.formatted.transcript || lastUserItem.formatted.text || '');
      }
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, [isReady, getClient, address, balance, connectWallet, disconnectWallet, approveUsdc]);

  useEffect(() => {
    const handleFocus = () => {
      if (isConnected) {
        reconnectClient().catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, reconnectClient]);

  /**
   * Render the application
   */
  return (
    <div data-component="Console">
      <div className="content-top">
        <div className="content-title">
          {/* <img src="/images/openai-logomark.svg" />
          <span>realtime console</span> */}
        </div>
        <div className="content-api-key">
          {!LOCAL_RELAY_SERVER_URL && apiKey && (
            <Button
              icon={Edit}
              iconPosition="end"
              buttonStyle="flush"
              label={`api key: ${apiKey.slice(0, 3)}...`}
              onClick={() => resetAPIKey()}
            />
          )}
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          {!isConnected && (
            <>
              <div className="smart-wallet-gif">
                <Image
                  src="/images/smart_wallet.gif"
                  alt="Smart Wallet Animation"
                  width={200}
                  height={200}
                  layout="responsive"
                />
              </div>

              <div className="smart-wallet-info">
                <h2 className="text-sm font-semibold mb-2">TALK2 🗣️ SMART WALLET</h2>
                <h1 className="text-4xl font-bold mb-4">Your Voice, Your Power</h1>
                <p className="text-xl mb-6">
                Control and manage your cryptocurrencies in a smart and fast way.
                </p>
              </div>
            </>
          )}

          <div className={`content-block waveform`} style={{ display: isConnected ? 'block' : 'none' }}>
            <div className="content-block-title">Assistant</div>
            <div className="content-block-body full flex flex-col items-center">
              <div 
                className="last-assistant-message w-full"
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  margin: '12px 0',
                  maxHeight: '80px',
                  overflowY: 'auto',
                  fontSize: '16px',
                  lineHeight: '1.4',
                  color: '#ffffff',
                  textAlign: 'center',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  wordBreak: 'break-word',
                  boxSizing: 'border-box',
                }}
              >
                {lastAssistantMessage}
              </div>
              <div className="visualization w-full flex justify-center">
                <div className="visualization-entry">
                  <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
                </div>
              </div>
              <div 
                className="last-user-message w-full"
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  margin: '12px 0',
                  maxHeight: '80px',
                  overflowY: 'auto',
                  fontSize: '16px',
                  lineHeight: '1.4',
                  color: '#ffffff',
                  textAlign: 'center',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  wordBreak: 'break-word',
                  boxSizing: 'border-box',
                }}
              >
                {lastUserMessage}
              </div>
            </div>
          </div>
          
          <div className="content-block events" style={{ display: 'none' }}>
            {/* <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div> */}
            <div className="content-block-title">events</div>
            <div className="content-block-body" ref={eventsScrollRef}>
              {!realtimeEvents.length && `awaiting connection...`}
              {realtimeEvents.map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          // toggle event details
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${
                            event.type === 'error'
                              ? 'error'
                              : realtimeEvent.source
                          }`}
                        >
                          {realtimeEvent.source === 'client' ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === 'error'
                              ? 'error!'
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-block conversation" style={{ display: 'none' }}>
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions flex flex-col items-center justify-center flex-grow">
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'Release to send' : 'Press to speak'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                className={`mb-4 ${isRecording ? 'large-button' : 'large-button-blue'}`}
              />
            )}
            <Button
              label={isConnected ? 'Disconnect' : 'Connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={isConnected ? disconnectConversation : connectConversation}
              disabled={!isReady}
              className={isConnected ? "large-button" : "large-button-blue"}
            />
          </div>
        </div>
        <div className="content-right" style={{ display: 'none' }}>
          {/*
          <div className="content-block map">
            <div className="content-block-title">get_weather()</div>
            <div className="content-block-title bottom">
              {marker?.location || 'not yet retrieved'}
              {!!marker?.temperature && (
                <>
                  <br />
                  🌡️ {marker.temperature.value} {marker.temperature.units}
                </>
              )}
              {!!marker?.wind_speed && (
                <>
                  {' '}
                  🍃 {marker.wind_speed.value} {marker.wind_speed.units}
                </>
              )}
            </div>
            <div className="content-block-body full">
              {coords && (
                <Map
                  center={[coords.lat, coords.lng]}
                  location={coords.location}
                />
              )}
            </div>
          </div>
          */}
          
          <div className="content-block onchain" style={{ display: 'none' }}>
            <div className="content-block-title">OnchainKit</div>
            <div className="content-block-body full">
              <div className="flex flex-col w-full h-full">
                <section className="mb-4 flex w-full flex-row items-center justify-between">
                  <a
                    href={ONCHAINKIT_LINK}
                    title="onchainkit"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <OnchainkitSvg />
                  </a>
                  <div className="flex items-center gap-3">
                    <SignupButton />
                    {!address && <LoginButton />}
                  </div>
                </section>
                <section className="flex grow flex-col items-center justify-center gap-4 rounded-xl bg-gray-100 p-4">
                  {address ? (
                    <>
                      <TransactionWrapper address={address} />
                      <TransferUsdcWrapper 
                        recipientAddress="0x361fd8769c1295Eb75F4E8f51015bc074Eb937B2"
                        amount="0.01"
                      />
                      <ApproveUsdcWrapper 
                        spenderAddress="0x361fd8769c1295Eb75F4E8f51015bc074Eb937B2"
                        amount="0.01"
                      />
                      <Button
                        label="Approve USDC and start a call"
                        buttonStyle="action"
                        onClick={approveUsdc}
                        className="mt-0 mr-auto ml-auto w-[450px] max-w-full text-[white]"
                      />
                    </>
                  ) : (
                    <WalletWrapper
                      className="w-full"
                      text="Sign in to transact"
                    />
                  )}
                  {showBalance && balance && (
                    <div className="text-sm">
                      Balance: {balance.formatted} {balance.symbol}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>

          {/* <div className="content-block waveform">
            <div className="content-block-title">Assistant</div>
            <div className="content-block-body full">
              <div className="last-assistant-message">{lastAssistantMessage}</div>
              <div className="visualization">
                <div className="visualization-entry">
                  <canvas ref={canvasRef} />
                </div>
              </div>
              <div className="last-user-message">{lastUserMessage}</div>
            </div>
          </div> */}
          
          <div className="content-block kv" style={{ display: 'none' }}>
            <div className="content-block-title">set_memory()</div>
            <div className="content-block-body content-kv">
              {JSON.stringify(memoryKv, null, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
