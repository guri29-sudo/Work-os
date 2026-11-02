/**
 * @license
 * WorkOS Communication System - Embeddable Host SDK
 *
 * Exposes:
 * 1. <CommunicationApp />: Single exported React component for host embedding.
 * 2. WorkOSCommunicationClient: Headless TypeScript API client for backend integration.
 * 3. Shared contracts & UI design primitives.
 */

import React, { useState, useEffect } from "react";
export * from "@cs/contracts";
export * from "@cs/ui";

export interface WorkOSObjectRef {
  type: string;
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskCreationContext {
  messageId: string;
  content: string;
  authorName: string;
}

export interface CommunicationAppProps {
  /** Callback to retrieve a valid, signed JWT identity token from WorkOS */
  getAccessToken: () => Promise<string>;
  /** Host callback when user clicks a referenced WorkOS project, task, or object */
  onOpenObject?: (object: WorkOSObjectRef) => void;
  /** Host callback when user requests creating a WorkOS task from a message */
  onCreateTask?: (context: TaskCreationContext) => void;
  /** UI theme */
  theme?: "light" | "dark";
  /** Optional custom API endpoint (defaults to http://localhost:3001) */
  apiUrl?: string;
  /** Optional custom WebSocket endpoint (defaults to ws://localhost:3001) */
  wsUrl?: string;
}

/**
 * Embeddable Root Component for WorkOS
 *
 * Usage in WorkOS:
 * ```tsx
 * import { CommunicationApp } from "@cs/sdk";
 *
 * <CommunicationApp
 *   getAccessToken={async () => workosAuth.getToken()}
 *   onOpenObject={(obj) => navigateToWorkOSObject(obj.type, obj.id)}
 *   onCreateTask={(ctx) => taskModal.open(ctx)}
 *   theme="dark"
 * />
 * ```
 */
export const CommunicationApp: React.FC<CommunicationAppProps> = ({
  getAccessToken,
  onOpenObject,
  onCreateTask,
  theme = "light",
  apiUrl = "http://localhost:3001",
  wsUrl = "ws://localhost:3001",
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getAccessToken()
      .then((t) => {
        if (isMounted) {
          setToken(t);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message ?? "Failed to acquire token from WorkOS host");
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [getAccessToken]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8 bg-slate-50 text-slate-500 text-xs">
        Connecting to WorkOS Internal Communication System...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8 bg-rose-50 text-rose-600 text-xs">
        Failed to authenticate communication module: {error}
      </div>
    );
  }

  return (
    <div
      className={`h-full w-full overflow-hidden ${theme === "dark" ? "dark" : ""}`}
      data-theme={theme}
      data-api-url={apiUrl}
      data-ws-url={wsUrl}
    >
      <iframe
        src={`${apiUrl.replace(/\/$/, "")}/embed?theme=${theme}`}
        className="w-full h-full border-0"
        title="WorkOS Communication App"
      />
    </div>
  );
};

/**
 * Headless TypeScript API client for host service integrations
 */
export class WorkOSCommunicationClient {
  private getAccessToken: () => Promise<string>;
  private baseUrl: string;

  constructor(opts: { getAccessToken: () => Promise<string>; baseUrl?: string }) {
    this.getAccessToken = opts.getAccessToken;
    this.baseUrl = (opts.baseUrl ?? "http://localhost:3001").replace(/\/$/, "");
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message ?? `Request failed with status ${res.status}`);
    }

    return res.json();
  }

  async listChannels() {
    return this.fetch<{ data: any[] }>("/v1/channels");
  }

  async createChannel(channel: { name: string; kind: string; topic?: string }) {
    return this.fetch<{ data: any }>("/v1/channels", {
      method: "POST",
      body: JSON.stringify(channel),
    });
  }

  async sendMessage(
    conversationId: string,
    message: {
      body: string;
      client_msg_id: string;
      attachment_ids?: string[];
      mention_ids?: string[];
      object_references?: WorkOSObjectRef[];
    },
  ) {
    return this.fetch<{ data: any }>(`/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(message),
    });
  }

  async search(query: string) {
    return this.fetch<{ items: any[] }>(`/v1/search?q=${encodeURIComponent(query)}`);
  }
}
