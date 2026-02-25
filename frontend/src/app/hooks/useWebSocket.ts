import { useEffect, useRef, useCallback, useState } from "react";
import { createWebSocket } from "../services/api";

type WSEventType =
  | "order:created"
  | "order:matched"
  | "order:cancelled"
  | "proof:generating"
  | "proof:generated"
  | "proof:verified"
  | "settlement:confirmed"
  | "activity:new"
  | "vault:updated"
  | "pool:updated"
  | "connected";

interface WSEvent {
  type: WSEventType;
  data: any;
  timestamp: string;
}

/**
 * Hook to subscribe to real WebSocket events from the backend.
 * Receives a callback for each event; optionally filter by event types.
 */
export function useWebSocket(
  onEvent: (event: WSEvent) => void,
  eventTypes?: WSEventType[]
) {
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const ws = createWebSocket((event) => {
      if (!eventTypes || eventTypes.includes(event.type as WSEventType)) {
        callbackRef.current(event as WSEvent);
      }
    });

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  return wsRef;
}

/**
 * Hook that provides latest WS events as state (useful for activity feeds).
 */
export function useWebSocketEvents(maxEvents = 20) {
  const [events, setEvents] = useState<WSEvent[]>([]);

  useWebSocket((event) => {
    setEvents((prev) => [event, ...prev].slice(0, maxEvents));
  });

  return events;
}
