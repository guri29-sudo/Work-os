import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext.js";

export type WsStatus = "connected" | "reconnecting" | "offline";

interface WebSocketContextType {
  status: WsStatus;
  lastEvent: { type: string; payload: unknown; ts: string } | null;
  sendJson: (data: unknown) => void;
  subscribe: (conversationId: string) => void;
  unsubscribe: (conversationId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<WsStatus>("offline");
  const [lastEvent, setLastEvent] = useState<{ type: string; payload: unknown; ts: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const activeSubsRef = useRef<Set<string>>(new Set());

  const sendJson = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribe = useCallback(
    (conversationId: string) => {
      activeSubsRef.current.add(conversationId);
      sendJson({ type: "subscribe", conversationId });
    },
    [sendJson],
  );

  const unsubscribe = useCallback(
    (conversationId: string) => {
      activeSubsRef.current.delete(conversationId);
      sendJson({ type: "unsubscribe", conversationId });
    },
    [sendJson],
  );

  const connect = useCallback(() => {
    if (!token) {
      setStatus("offline");
      return;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }

    setStatus("reconnecting");
    const wsBase =
      (import.meta.env.VITE_COMMUNICATION_WS_URL as string | undefined) ||
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
        : "");
    if (!wsBase) {
      setStatus("offline");
      return;
    }
    const ws = new WebSocket(`${wsBase.replace(/\/$/, "")}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send auth frame explicitly as well
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "auth_ack") {
          setStatus("connected");
          for (const convId of activeSubsRef.current) {
            ws.send(JSON.stringify({ type: "subscribe", conversationId: convId }));
          }
        } else if (parsed.type === "subscribed") {
          // subscribed ack
        } else if (parsed.type === "unsubscribed") {
          // unsubscribed ack
        } else if (parsed.type === "error") {
          // server error
        }

        setLastEvent({
          type: parsed.type ?? "message",
          payload: parsed,
          ts: new Date().toISOString(),
        });
      } catch {
        // ignore non-json
      }
    };

    ws.onclose = () => {
      setStatus("offline");
      if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ status, lastEvent, sendJson, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return ctx;
}
