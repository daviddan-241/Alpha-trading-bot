import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";
import { startTelegramBot } from "./telegram-bot";

const app: Express = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDist = path.resolve(currentDir, "../../dashboard/dist/public");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/dashboard", express.static(dashboardDist));
app.get("/", (_req, res) => {
  res.redirect("/dashboard/");
});
app.get("/dashboard/*splat", (_req, res) => {
  res.sendFile(path.join(dashboardDist, "index.html"));
});

void Promise.resolve(startTelegramBot()).catch((e) =>
  logger.error({ e }, "Bot failed to start"),
);

export default app;
