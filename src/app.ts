// src/app.ts
import express from "express"; 
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; 
import cors, { CorsOptions, CorsRequest } from "cors"; 
import { createAppRouter } from "./routes/appRouter.js"; 

//  createApp - builds the express app and returns it to server.ts
export function createApp(server: McpServer) {
  const app = express(); // create express instance

  //  allowed addresses (origins) for HTTP requests
  const allowedOrigins = [
    "http://localhost:3000",     // local dev
    "http://127.0.0.1:3000",     // alternative localhost
    "http://127.0.0.1:5500",     // Live Server extension
    "https://your-domain.com",  
    "http://127.0.0.1:5501", // production
  ];

  //  CORS middleware configuration
  const corsOptions: CorsOptions = {
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true); // allow
      } else {
        console.warn("🚫 Blocked request from:", origin);
        callback(new Error("Not allowed by CORS")); // block
      }
    },
    methods: ["GET", "POST", "OPTIONS"], // allowed methods
    allowedHeaders: ["Content-Type"], // allowed headers
    credentials: false, // no credentials in CORS
  };
  //  CORS configuration END

  //  Express setup & middlewares
  app.use(cors<CorsRequest>(corsOptions)); // use cors rules globally
  app.disable("x-powered-by"); // hide express header
  app.use(express.json()); // parse JSON bodies
  app.use(express.static("public")); // serve static files (like widget.js)
  //  Express setup END

  //  Mount the main router (all routes from appRouter.ts)
  app.use("/", createAppRouter(server));

  return app; // return the fully configured express app
}
