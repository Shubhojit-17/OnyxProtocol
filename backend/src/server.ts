import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import rateLimit from "express-rate-limit";
import { wsManager } from "./websocket/manager.js";
import { runMatcher, startStuckMatchRetry } from "./services/matcher.service.js";
import { isStarknetEnabled } from "./services/starknet.service.js";
import prisma from "./db/prisma.js";

// Routes
import userRoutes from "./routes/user.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import vaultRoutes from "./routes/vault.routes.js";
import orderRoutes from "./routes/order.routes.js";
import executionRoutes from "./routes/execution.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import historyRoutes from "./routes/history.routes.js";
import complianceRoutes from "./routes/compliance.routes.js";
import darkpoolRoutes from "./routes/darkpool.routes.js";
import starknetRoutes from "./routes/starknet.routes.js";

const app = express();
const server = createServer(app);

// Middleware
const allowedOrigins = [
  /^https?:\/\/localhost(:\d+)?$/,
  ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, mobile apps)
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((o) =>
        o instanceof RegExp ? o.test(origin) : o === origin
      );
      if (isAllowed) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", limiter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    wsClients: wsManager.getClientCount(),
  });
});

// Register routes
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/vault", vaultRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", executionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/darkpool", darkpoolRoutes);
app.use("/api/starknet", starknetRoutes);

// Initialize WebSocket
wsManager.init(server);

const PORT = parseInt(process.env.PORT || "3001", 10);

server.listen(PORT, "0.0.0.0", () => {
  const starknetStatus = isStarknetEnabled() ? "✅ LIVE (Starknet Sepolia)" : "⚠️  Simulated (set STARKNET env vars for on-chain)";
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │   🔮 Onyx Protocol Backend                              │
  │   Running on http://localhost:${PORT}                      │
  │   WebSocket on ws://localhost:${PORT}/ws                   │
  │   Starknet: ${starknetStatus.padEnd(43)}│
  │                                                         │
  └─────────────────────────────────────────────────────────┘
  `);

  // Periodic matcher: every 10 seconds, try to match open orders
  setInterval(() => {
    runMatcher().catch((err) => console.error("Periodic matcher error:", err));
  }, 10_000);

  // Start periodic stuck match retry (every 30s)
  startStuckMatchRetry();

  // Startup diagnostics: log open orders count
  prisma.orderCommitment
    .count({ where: { status: "CREATED" } })
    .then(async (openCount) => {
      if (openCount > 0) {
        console.log(`  ⚠️  ${openCount} open order(s) in database from previous session`);
      }
      // Migrate legacy orders: enable cross-pair matching for orders created before the feature
      const migrated = await prisma.orderCommitment.updateMany({
        where: { status: "CREATED", allowCrossPair: false },
        data: { allowCrossPair: true },
      });
      if (migrated.count > 0) {
        console.log(`  🔄 Migrated ${migrated.count} order(s) to allow cross-pair matching`);
      }
    })
    .catch(() => {});
});

export { app, server };
