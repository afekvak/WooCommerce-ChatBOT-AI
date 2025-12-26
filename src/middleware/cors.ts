// src/middleware/cors.ts
import cors, { CorsOptions, CorsRequest } from "cors";

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",

  "http://localhost:5500",
  "http://127.0.0.1:5500",

  "http://localhost:5501",
  "http://127.0.0.1:5501",

  "http://44.193.148.170",
  "https://your-domain.com",
];

export const corsOptions: CorsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
    // Allow same origin requests that do not send Origin
    if (!origin) return callback(null, true);

    // Allow file contexts
    if (origin === "null") return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.warn("Blocked request from:", origin);
    return callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 204,
};

export const corsMiddleware = cors<CorsRequest>(corsOptions);
