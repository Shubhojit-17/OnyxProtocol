import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export type WSEventType =
  | "order:created"
  | "order:matched"
  | "order:cancelled"
  | "proof:generating"
  | "proof:generated"
  | "proof:verified"
  | "settlement:confirmed"
  | "activity:new"
  | "vault:updated"
  | "pool:updated";

export interface WSEvent {
  type: WSEventType;
  data: unknown;
  timestamp: string;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  init(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      console.log(`[WS] Client connected. Total: ${this.clients.size}`);

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });

      ws.on("error", (err) => {
        console.error("[WS] Client error:", err.message);
        this.clients.delete(ws);
      });

      // Send welcome
      ws.send(
        JSON.stringify({
          type: "connected",
          data: { message: "Connected to Onyx Protocol WebSocket" },
          timestamp: new Date().toISOString(),
        })
      );
    });

    console.log("[WS] WebSocket server initialized on /ws");
  }

  broadcast(event: WSEvent) {
    const message = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  emit(type: WSEventType, data: unknown) {
    this.broadcast({
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton
export const wsManager = new WebSocketManager();
