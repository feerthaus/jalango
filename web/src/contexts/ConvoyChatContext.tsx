import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { speak, useVoiceAlerts, useVoiceLang, vibrate } from '@/hooks/useVoiceAlerts';
import { fetchConvoyMessages, sendConvoyMessage, subscribeToConvoyMessages, type ConvoyMessage } from '@/services/convoyChatService';
import { quickBody, quickMeta, spokenMessage, type QuickId } from '@/utils/convoyChat';
import { useConvoy } from './ConvoyContext';
import { useLocation } from './LocationContext';

interface ConvoyChatValue {
  messages: ConvoyMessage[];
  unread: number;
  /** the latest message from someone else, for a short banner while driving */
  incoming: ConvoyMessage | null;
  dismissIncoming: () => void;
  markRead: () => void;
  send: (body: string) => Promise<void>;
  sendQuick: (id: QuickId) => Promise<void>;
}

const ConvoyChatContext = createContext<ConvoyChatValue | null>(null);
const POLL_MS = 20_000;
const SEEN_KEY = 'jalango:convoy-chat-seen';

/** Chat for the convoy you're in. Messages live only as long as the convoy. */
export function ConvoyChatProvider({ children }: { children: ReactNode }) {
  const { convoy, me, members } = useConvoy();
  const { fix } = useLocation();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const [messages, setMessages] = useState<ConvoyMessage[]>([]);
  const [seenAt, setSeenAt] = useState<string>(() => {
    try {
      return localStorage.getItem(SEEN_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [incoming, setIncoming] = useState<ConvoyMessage | null>(null);
  const announced = useRef(new Set<string>());
  const loaded = useRef(false);
  const convoyId = convoy?.id ?? null;
  const myId = me?.user_id ?? null;
  const nameOf = useRef<(id: string) => string>(() => '');
  nameOf.current = (id) => members.find((m) => m.user_id === id)?.display_name ?? '…';

  const add = useCallback((list: ConvoyMessage[]) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of list) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-100);
    });
  }, []);

  // Load, then realtime with polling as the fallback
  useEffect(() => {
    setMessages([]);
    setIncoming(null);
    if (!convoyId) return;
    let stop = false;
    const load = () =>
      fetchConvoyMessages(convoyId)
        .then((l) => {
          if (stop) return;
          // what was there when we opened isn't "new": don't read it aloud
          if (!loaded.current) {
            loaded.current = true;
            l.forEach((m) => announced.current.add(m.id));
          }
          add(l);
        })
        .catch(() => undefined);
    void load();
    const unsub = subscribeToConvoyMessages(convoyId, (m) => add([m]));
    const id = setInterval(load, POLL_MS);
    return () => {
      stop = true;
      unsub();
      clearInterval(id);
      announced.current = new Set();
      loaded.current = false;
    };
  }, [convoyId, add]);

  // Someone else's new message: banner, a buzz, and read aloud (if voice is on)
  useEffect(() => {
    const fresh = messages.filter((m) => m.user_id !== myId && !announced.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => announced.current.add(m.id));
    const last = fresh[fresh.length - 1];
    setIncoming(last);
    vibrate(quickMeta(last.quick)?.id === 'hazard' ? [200, 80, 200] : 120);
    if (voiceOn) speak(spokenMessage(nameOf.current(last.user_id), last.body, last.quick, lang), lang);
  }, [messages, myId, voiceOn, lang]);

  // Hide the banner after a few seconds
  useEffect(() => {
    if (!incoming) return;
    const id = setTimeout(() => setIncoming(null), 9000);
    return () => clearTimeout(id);
  }, [incoming]);

  const markRead = useCallback(() => {
    const last = messages[messages.length - 1]?.created_at ?? '';
    setSeenAt(last);
    try {
      localStorage.setItem(SEEN_KEY, last);
    } catch {
      /* ignore */
    }
  }, [messages]);

  const send = useCallback(
    async (body: string) => {
      if (!convoyId) return;
      const id = await sendConvoyMessage(convoyId, body);
      announced.current.add(id);
      if (convoyId) add(await fetchConvoyMessages(convoyId, 10));
    },
    [convoyId, add],
  );

  const sendQuick = useCallback(
    async (q: QuickId) => {
      if (!convoyId) return;
      const at = quickMeta(q)?.located && fix && fix.accuracy <= 100 ? fix.coordinates : null;
      const id = await sendConvoyMessage(convoyId, quickBody(q, lang), q, at);
      announced.current.add(id);
      add(await fetchConvoyMessages(convoyId, 10));
    },
    [convoyId, fix, lang, add],
  );

  const unread = messages.filter((m) => m.user_id !== myId && m.created_at > seenAt).length;
  const value = useMemo<ConvoyChatValue>(
    () => ({ messages, unread, incoming, dismissIncoming: () => setIncoming(null), markRead, send, sendQuick }),
    [messages, unread, incoming, markRead, send, sendQuick],
  );
  return <ConvoyChatContext.Provider value={value}>{children}</ConvoyChatContext.Provider>;
}

export function useConvoyChat(): ConvoyChatValue {
  const ctx = useContext(ConvoyChatContext);
  if (!ctx) throw new Error('useConvoyChat must be used within ConvoyChatProvider');
  return ctx;
}
