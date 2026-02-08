import WebSocket from 'ws';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

type WebSocketHeartbeatOptions = {
  pingIntervalMs?: number
  pongTimeoutMs?: number
}

export class WebSocketServerTransport implements Transport {
  private ws: WebSocket;
  public onmessage: ((message: any) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((error: Error) => void) | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastActivityAt = 0;
  private heartbeatOptions: { pingIntervalMs: number; pongTimeoutMs: number };

  constructor(ws: WebSocket, options?: WebSocketHeartbeatOptions) {
    this.ws = ws;
    const pingIntervalMs = Math.max(1000, Number(process.env.WS_PING_INTERVAL_MS) || 25000);
    const pongTimeoutMs = Math.max(2000, Number(process.env.WS_PONG_TIMEOUT_MS) || 60000);
    this.heartbeatOptions = {
      pingIntervalMs: options?.pingIntervalMs ?? pingIntervalMs,
      pongTimeoutMs: options?.pongTimeoutMs ?? pongTimeoutMs
    };

    this.ws.on('message', () => {
      this.lastActivityAt = Date.now();
    });

    this.ws.on('pong', () => {
      this.lastActivityAt = Date.now();
    });

    this.ws.on('close', () => {
      this.stopHeartbeat();
    });
  }

  async start(): Promise<void> {
    // Transport is already started when WebSocket connection is established
    if (this.ws.readyState === WebSocket.OPEN) {
      this.startHeartbeat();
    } else {
      this.ws.once('open', () => this.startHeartbeat());
    }
  }

  async send(message: any): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  async close(): Promise<void> {
    this.stopHeartbeat();
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.lastActivityAt = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (now - this.lastActivityAt > this.heartbeatOptions.pongTimeoutMs) {
        this.ws.terminate();
        return;
      }
      try {
        this.ws.ping();
      } catch (error) {
        if (this.onerror) this.onerror(error as Error);
      }
    }, this.heartbeatOptions.pingIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
} 
