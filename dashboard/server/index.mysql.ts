import express, { Request, Response, NextFunction } from "express";
import { setupAuth } from "./auth.mysql";
import { registerRoutes } from "./routes";
import { log } from "./vite";
import { json } from "express";

async function main() {
  const app = express();

  app.use(json());
  app.use(express.urlencoded({ extended: false }));

  // Set up authentication (session handling, passport, login routes)
  setupAuth(app);

  // Register application routes
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    log(`[error] ${err.stack}`);
    res.status(500).json({ error: "Internal Server Error" });
  });

  // Start the server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    log(`serving on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(`Server failed to start: ${err}`);
  process.exit(1);
});