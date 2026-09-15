import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Serves Better Auth under `/api/auth/*` on the Convex site URL. The Nuxt app
// proxies its own `/api/auth/*` here, so cookies stay first-party and no CORS
// headers are needed.
authComponent.registerRoutes(http, createAuth, { cors: false });

export default http;
