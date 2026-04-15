import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { getTelegramBot, getBotStats, getTrenchesStats } from "../telegram-bot";

const router: IRouter = Router();

router.use(healthRouter);

router.post("/telegram-webhook", async (req, res) => {
  try {
    const bot = getTelegramBot();
    if (bot) {
      await bot.processUpdate(req.body);
    }
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(200);
  }
});

router.get("/stats", (_req, res) => {
  try {
    res.json(getBotStats());
  } catch (e) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/trenches", async (_req, res) => {
  try {
    res.json(await getTrenchesStats());
  } catch (e) {
    res.status(500).json({ error: "Failed to get trenches" });
  }
});

export default router;
