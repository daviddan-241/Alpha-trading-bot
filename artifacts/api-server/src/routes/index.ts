import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { getTelegramBot } from "../telegram-bot";

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

export default router;
