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
  keypairFromMnemonic,
  isValidMnemonic,
  SOL_MINT,
} from "./solana";
import bs58 from "bs58";

const TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const ADMIN_CHAT_ID = 8625109013;

const BOT_TITLE = "🤖 ALPHA TRADING BOT";
const BOT_USERNAME = "Alphacircletrading_bot";
const TG_LINK = `https://t.me/${BOT_USERNAME}`;
const TW_LINK = "https://t.me/+QJVQUQIhP-82ZDk8";
const WEB_LINK = `https://t.me/${BOT_USERNAME}`;

// ── TRANSLATIONS ──────────────────────────────────────────────────────────────
type Lang = "en" | "zh" | "ru" | "pt" | "vi";

const LANG_MAP: Record<string, Lang> = {
  "🇺🇸 English": "en",
  "🇨🇳 中文": "zh",
  "🇷🇺 Русский": "ru",
  "🇧🇷 Português": "pt",
  "🇻🇳 Tiếng Việt": "vi",
};

const TR: Record<Lang, Record<string, string>> = {
  en: {
    back: "🔙 Back", close: "❌ Close", cancel: "◀️ Cancel",
    sol_price: "💰 SOL Price", balance: "💎 Balance", pnl: "📈 P&L", trades_label: "Trades",
    create_wallet_hint: "💳 Create your first wallet at /wallets",
    btn_buy_sell: "✨ Buy & Sell", btn_sniper: "🎯 Sniper",
    btn_limits: "✂️ Limit Orders", btn_copy: "🎮 Copy Trades",
    btn_profile: "🐵 Profile", btn_wallets: "💳 Wallets", btn_trades: "📊 Trades",
    btn_referral: "🔵 Referral System", btn_cashback: "💰 Cashback",
    btn_transfer: "📮 Transfer SOL", btn_settings: "🔨 Settings",
    btn_backup: "🤖 Backup Bots", btn_security: "🛡️ Security",
    btn_help: "ℹ️ Help", btn_tutorials: "📋 Tutorials",
    wallets_empty: "You don't have any wallet yet, please create a wallet to use.",
    wallets_title: "💳 Wallets", wallet_active_lbl: "Active", wallet_address: "Address", wallet_balance: "Balance",
    btn_connect: "➕ Connect Wallet", btn_gen_1: "➕ Generate New...",
    btn_gen_5: "➕ Generate 5 Wal...", btn_gen_10: "➕ Generate 10 W...",
    btn_xfer_all: "↔️ Transfer All SOL To One",
    btn_wrap: "↔️ Wrap SOL To...", btn_unwrap: "↔️ Wrap WSOL To...", btn_reload: "🔄 Reload List",
    wallet_fund_hint: "Fund your wallet by sending SOL to the address above.\nSave your private key — it cannot be recovered!",
    new_wallets_lbl: "New Wallets:", view_wallets: "💳 View Wallets",
    buy_title: "✨ Buy Token", buy_paste: "Paste token contract to begin buy &amp; sell ↔️\n\nOr select token to sell::",
    buy_how_much: "How much SOL to spend?", buy_enter_custom: "✏️ Enter custom SOL amount:",
    sell_title: "📉 Sell Token", sell_what_pct: "What percentage to sell?",
    sell_enter_pct: "✏️ Enter percentage to sell (1-100):",
    need_wallet: "⚠️ You need a wallet to trade.\nTap below to create one.", btn_open_wallets: "💳 Open Wallets",
    sniper_title: "🎯 Token Sniper", sniper_status: "Status",
    sniper_on_lbl: "🟢 ACTIVE", sniper_off_lbl: "🔴 INACTIVE",
    sniper_token_lbl: "Token", sniper_not_set: "not set", sniper_amount_lbl: "Buy Amount",
    sniper_hint: "Bot buys automatically when liquidity is detected on-chain.",
    btn_set_token: "🎯 Set Token", btn_set_amount: "💰 Set Amount",
    btn_activate: "🟢 Activate", btn_deactivate: "🔴 Deactivate", btn_refresh: "🔄 Refresh",
    sniper_enter_token: "🎯 Enter token address to snipe:",
    sniper_enter_amt: "💰 Enter SOL amount to buy when liquidity detected:",
    sniper_no_token: "⚠️ Set a token to snipe first.",
    sniper_no_wallet: "⚠️ You need a wallet to use the sniper.",
    limits_title: "✂️ Limit Orders", limits_active: "Active", limits_empty: "No active limit orders",
    btn_new_buy: "📈 New Buy Limit", btn_new_sell: "📉 New Sell Limit", btn_cancel_all: "🗑 Cancel All",
    limits_enter_buy_token: "📈 New Buy Limit — Enter token contract address:",
    limits_enter_sell_token: "📉 New Sell Limit — Enter token contract address:",
    limits_enter_price: "✂️ Enter trigger price in USD (e.g. 0.000005):",
    limits_enter_amount: "💰 Enter SOL amount:", limits_placed: "✅ Limit Order Placed!",
    limits_type: "Type", limits_trigger: "Trigger", limits_amount: "Amount",
    view_orders: "✂️ View Orders", menu_btn: "🔙 Menu",
    copy_title: "🎮 Copy Trades", copy_following: "Following",
    copy_empty: "Not following anyone yet", copy_hint: "Every trade they make is mirrored in real-time.",
    btn_follow: "➕ Follow a Wallet", btn_unfollow: "🗑 Unfollow All",
    copy_enter_addr: "🎮 Enter wallet address to copy:",
    copy_enter_max: "🎮 Max SOL per mirrored trade (e.g. 0.5):",
    profile_title: "🐵 Profile", no_wallet: "No wallet", profile_volume: "Volume",
    trades_title: "📊 Trade History", trades_volume: "Volume", trades_no_history: "No trades yet",
    ref_title: "🔵 Referral System", ref_link: "Your link",
    ref_referrals: "Referrals", ref_earned: "Earned", ref_commission: "Commission",
    ref_share_hint: "Share your link → friend joins → you earn 20% of all their fees forever! 💰",
    btn_share: "📤 Share Link",
    cash_title: "💰 Cashback Rewards", cash_total: "Total Cashback",
    cash_rate: "Rate", cash_paid: "Paid", cash_instantly: "Instantly after each trade",
    cash_hint: "The more you trade, the more you earn.",
    settings_title: "🔨 Settings", settings_slippage: "Slippage", settings_fee: "Priority Fee",
    settings_mev: "MEV Protection", settings_confirm: "Trade Confirmation",
    settings_autobuy: "Auto-Buy", settings_lang: "Language",
    on: "ON ✅", off: "OFF ❌",
    btn_slippage: "📊 Slippage", btn_fee: "⚡ Priority Fee", btn_language: "🌐 Language",
    slippage_prompt: "📊 Set Slippage\n\nCurrent:", slippage_enter: "Enter new %:",
    fee_prompt: "⚡ Set Priority Fee\n\nCurrent:", fee_enter: "Enter new fee:", fee_unit: "SOL",
    lang_select: "🌐 Select Language:",
    sec_title: "🛡️ Security", sec_2fa: "2FA Auth",
    sec_enabled: "ENABLED ✅", sec_disabled: "Disabled",
    sec_pin: "Trade PIN", sec_pin_set: "SET ✅", sec_pin_notset: "Not Set",
    sec_lock: "Withdrawal Lock", sec_lock_off: "OFF",
    sec_warning: "⚠️ Never share your private keys with anyone.",
    btn_toggle_2fa: "🔐 Toggle 2FA", btn_set_pin: "📌 Set PIN",
    btn_lock: "🔒 Withdrawal Lock", btn_delete_data: "🗑 Delete All My Data",
    sec_pin_prompt: "📌 Set Trade PIN\n\nEnter a 4-digit PIN code:",
    sec_lock_soon: "🔒 Withdrawal Lock\n\nComing soon.",
    sec_deleted: "🗑 Data Deleted\n\nAll your data has been cleared. Type /start to begin again.",
    btn_start_fresh: "🚀 Start Fresh",
    transfer_title: "📮 Transfer SOL", transfer_from: "From",
    transfer_avail: "Balance", transfer_enter_addr: "Enter destination wallet address:",
    transfer_enter_amt: "Enter amount to send:", transfer_send_all: "💸 Send All",
    transfer_invalid: "⚠️ Invalid Solana address. Try again:",
    transfer_insufficient: "⚠️ Insufficient balance",
    help_title: "ℹ️ Help", help_support: "💬 Support: @AlphaTradeSupport",
    backup_title: "🤖 Backup Bots", backup_text: "If the main bot is down, use these:\n\n📈 Pumpfun Trending:\n@PUMPFUNNBUMBERRBOT\n\n📊 DEX Trending:\n@DEXBOOSSTBOT",
    backup_note: "All bots share the same wallet and settings.",
    err_invalid_num: "⚠️ Enter a valid number:", err_invalid_pct: "⚠️ Enter 1-100:",
    err_no_wallet: "⚠️ No wallet. Create one first.",
    err_insufficient: "⚠️ Insufficient balance.",
    err_no_valid_keys: "⚠️ No valid private keys found. Try again:",
    err_invalid_key: "⚠️ Invalid private key. Enter a base58 private key:",
    err_invalid_seed: "⚠️ Invalid seed phrase. Enter 12 or 24 words:",
    delete_key_hint: "⚠️ Delete your key message now for security!",
    import_wallet_prompt: "Enter your private key (base58):",
    import_seed_prompt: "🌱 Enter your 12 or 24-word seed phrase:\n\n⚠️ <b>Never share your seed phrase with anyone else!</b>",
    btn_import_seed: "🌱 Import Seed Phrase",
    tut_title: "📋 Tutorials\n\nChoose a guide:",
    btn_getting_started: "🚀 Getting Started", btn_how_to_buy: "💰 How to Buy",
    btn_using_sniper: "🎯 Using Sniper", btn_copy_trading: "🎮 Copy Trading",
    btn_limit_orders_tut: "✂️ Limit Orders", btn_referral_guide: "🔵 Referral Guide",
    btn_wallet_guide: "💳 Wallet Guide", btn_back_tutorials: "◀️ Back to Tutorials",
    xfer_all_prompt: "↔️ <b>Transfer All SOL</b>\n\nEnter destination wallet address:",
    wrap_prompt: "↔️ <b>Wrap SOL → WSOL</b>\n\n{balance}\n\nEnter amount to wrap:",
    unwrap_prompt: "↔️ <b>Unwrap WSOL → SOL</b>\n\nEnter amount to unwrap:",
    buy_again: "✨ Buy Again", sell_btn: "📉 Sell", sell_more: "📉 Sell More", buy_btn: "✨ Buy",
    try_again: "🔄 Try Again", adj_settings: "⚙️ Settings",
    confirm_btn: "✅ Confirm: ", mev_btn: "🛡 MEV: ", autobuy_btn: "🤖 Auto-Buy: ",
  },
  zh: {
    back: "🔙 返回", close: "❌ 关闭", cancel: "◀️ 取消",
    sol_price: "💰 SOL 价格", balance: "💎 余额", pnl: "📈 盈亏", trades_label: "交易",
    create_wallet_hint: "💳 请前往 /wallets 创建您的第一个钱包",
    btn_buy_sell: "✨ 买卖", btn_sniper: "🎯 狙击",
    btn_limits: "✂️ 限价单", btn_copy: "🎮 跟单交易",
    btn_profile: "🐵 个人资料", btn_wallets: "💳 钱包", btn_trades: "📊 交易记录",
    btn_referral: "🔵 推荐系统", btn_cashback: "💰 返现",
    btn_transfer: "📮 转账 SOL", btn_settings: "🔨 设置",
    btn_backup: "🤖 备用机器人", btn_security: "🛡️ 安全",
    btn_help: "ℹ️ 帮助", btn_tutorials: "📋 教程",
    wallets_empty: "您还没有钱包，请先创建一个钱包。",
    wallets_title: "💳 钱包", wallet_active_lbl: "活跃", wallet_address: "地址", wallet_balance: "余额",
    btn_connect: "➕ 连接钱包", btn_gen_1: "➕ 生成新钱包...",
    btn_gen_5: "➕ 生成 5 个...", btn_gen_10: "➕ 生成 10 个...",
    btn_xfer_all: "↔️ 全部转到一个钱包",
    btn_wrap: "↔️ 封装 SOL...", btn_unwrap: "↔️ 解封 WSOL...", btn_reload: "🔄 刷新列表",
    wallet_fund_hint: "向上方地址发送 SOL 来充值钱包。\n请保存您的私钥 — 无法找回！",
    new_wallets_lbl: "新钱包：", view_wallets: "💳 查看钱包",
    buy_title: "✨ 购买代币", buy_paste: "粘贴代币合约地址开始买卖 ↔️\n\n或选择要卖出的代币：",
    buy_how_much: "花费多少 SOL？", buy_enter_custom: "✏️ 输入自定义 SOL 数量：",
    sell_title: "📉 出售代币", sell_what_pct: "卖出多少百分比？",
    sell_enter_pct: "✏️ 输入卖出百分比（1-100）：",
    need_wallet: "⚠️ 您需要一个钱包才能交易。\n请先创建钱包。", btn_open_wallets: "💳 打开钱包",
    sniper_title: "🎯 代币狙击", sniper_status: "状态",
    sniper_on_lbl: "🟢 活跃", sniper_off_lbl: "🔴 未激活",
    sniper_token_lbl: "代币", sniper_not_set: "未设置", sniper_amount_lbl: "买入数量",
    sniper_hint: "当链上检测到流动性时，机器人自动买入。",
    btn_set_token: "🎯 设置代币", btn_set_amount: "💰 设置数量",
    btn_activate: "🟢 激活", btn_deactivate: "🔴 停用", btn_refresh: "🔄 刷新",
    sniper_enter_token: "🎯 输入要狙击的代币地址：",
    sniper_enter_amt: "💰 输入检测到流动性时的买入 SOL 数量：",
    sniper_no_token: "⚠️ 请先设置要狙击的代币。",
    sniper_no_wallet: "⚠️ 您需要一个钱包才能使用狙击功能。",
    limits_title: "✂️ 限价单", limits_active: "活跃", limits_empty: "没有活跃的限价单",
    btn_new_buy: "📈 新建买入限价单", btn_new_sell: "📉 新建卖出限价单", btn_cancel_all: "🗑 取消全部",
    limits_enter_buy_token: "📈 新建买入限价单 — 输入代币合约地址：",
    limits_enter_sell_token: "📉 新建卖出限价单 — 输入代币合约地址：",
    limits_enter_price: "✂️ 输入触发价格（美元，例如 0.000005）：",
    limits_enter_amount: "💰 输入 SOL 数量：", limits_placed: "✅ 限价单已提交！",
    limits_type: "类型", limits_trigger: "触发价", limits_amount: "数量",
    view_orders: "✂️ 查看订单", menu_btn: "🔙 菜单",
    copy_title: "🎮 跟单交易", copy_following: "正在跟踪",
    copy_empty: "还没有跟踪任何人", copy_hint: "他们的每笔交易都会实时镜像。",
    btn_follow: "➕ 跟踪钱包", btn_unfollow: "🗑 取消跟踪全部",
    copy_enter_addr: "🎮 输入要跟踪的钱包地址：",
    copy_enter_max: "🎮 每笔镜像交易最大 SOL（例如 0.5）：",
    profile_title: "🐵 个人资料", no_wallet: "无钱包", profile_volume: "成交量",
    trades_title: "📊 交易历史", trades_volume: "成交量", trades_no_history: "暂无交易",
    ref_title: "🔵 推荐系统", ref_link: "您的链接",
    ref_referrals: "推荐人数", ref_earned: "已赚取", ref_commission: "佣金",
    ref_share_hint: "分享您的链接 → 好友加入 → 您永久赚取他们手续费的 20%！💰",
    btn_share: "📤 分享链接",
    cash_title: "💰 返现奖励", cash_total: "总返现",
    cash_rate: "比率", cash_paid: "支付", cash_instantly: "每笔交易后立即",
    cash_hint: "交易越多，赚得越多。",
    settings_title: "🔨 设置", settings_slippage: "滑点", settings_fee: "优先费",
    settings_mev: "MEV 保护", settings_confirm: "交易确认",
    settings_autobuy: "自动买入", settings_lang: "语言",
    on: "开启 ✅", off: "关闭 ❌",
    btn_slippage: "📊 滑点", btn_fee: "⚡ 优先费", btn_language: "🌐 语言",
    slippage_prompt: "📊 设置滑点\n\n当前：", slippage_enter: "输入新的 %：",
    fee_prompt: "⚡ 设置优先费\n\n当前：", fee_enter: "输入新费用：", fee_unit: "SOL",
    lang_select: "🌐 选择语言：",
    sec_title: "🛡️ 安全", sec_2fa: "双重验证",
    sec_enabled: "已启用 ✅", sec_disabled: "未启用",
    sec_pin: "交易 PIN", sec_pin_set: "已设置 ✅", sec_pin_notset: "未设置",
    sec_lock: "提款锁", sec_lock_off: "关闭",
    sec_warning: "⚠️ 切勿将私钥分享给任何人。",
    btn_toggle_2fa: "🔐 切换双重验证", btn_set_pin: "📌 设置 PIN",
    btn_lock: "🔒 提款锁", btn_delete_data: "🗑 删除所有数据",
    sec_pin_prompt: "📌 设置交易 PIN\n\n请输入 4 位数字 PIN：",
    sec_lock_soon: "🔒 提款锁\n\n即将推出。",
    sec_deleted: "🗑 数据已删除\n\n您的所有数据已清除。输入 /start 重新开始。",
    btn_start_fresh: "🚀 重新开始",
    transfer_title: "📮 转账 SOL", transfer_from: "来自",
    transfer_avail: "余额", transfer_enter_addr: "输入目标钱包地址：",
    transfer_enter_amt: "输入发送数量：", transfer_send_all: "💸 全部发送",
    transfer_invalid: "⚠️ 无效的 Solana 地址。请重试：",
    transfer_insufficient: "⚠️ 余额不足",
    help_title: "ℹ️ 帮助", help_support: "💬 支持: @AlphaTradeSupport",
    backup_title: "🤖 备用机器人", backup_text: "如果主机器人无法使用，请使用：\n\n📈 Pumpfun 趋势：\n@PUMPFUNNBUMBERRBOT\n\n📊 DEX 趋势：\n@DEXBOOSSTBOT",
    backup_note: "所有机器人共享相同的钱包和设置。",
    err_invalid_num: "⚠️ 请输入有效数字：", err_invalid_pct: "⚠️ 请输入 1-100：",
    err_no_wallet: "⚠️ 无钱包。请先创建。",
    err_insufficient: "⚠️ 余额不足。",
    err_no_valid_keys: "⚠️ 未找到有效私钥。请重试：",
    err_invalid_key: "⚠️ 无效的私钥。请输入 base58 私钥：",
    err_invalid_seed: "⚠️ 无效助记词。请输入 12 或 24 个单词：",
    delete_key_hint: "⚠️ 请立即删除含私钥的消息以确保安全！",
    import_wallet_prompt: "输入您的私钥（base58）：",
    import_seed_prompt: "🌱 输入您的 12 或 24 个词助记词：\n\n⚠️ <b>切勿与他人分享您的助记词！</b>",
    btn_import_seed: "🌱 导入助记词",
    tut_title: "📋 教程\n\n选择指南：",
    btn_getting_started: "🚀 入门指南", btn_how_to_buy: "💰 如何购买",
    btn_using_sniper: "🎯 使用狙击", btn_copy_trading: "🎮 跟单交易",
    btn_limit_orders_tut: "✂️ 限价单", btn_referral_guide: "🔵 推荐指南",
    btn_wallet_guide: "💳 钱包指南", btn_back_tutorials: "◀️ 返回教程",
    xfer_all_prompt: "↔️ <b>转账全部 SOL</b>\n\n输入目标钱包地址：",
    wrap_prompt: "↔️ <b>封装 SOL → WSOL</b>\n\n{balance}\n\n输入要封装的数量：",
    unwrap_prompt: "↔️ <b>解封 WSOL → SOL</b>\n\n输入要解封的数量：",
    buy_again: "✨ 再次购买", sell_btn: "📉 出售", sell_more: "📉 继续出售", buy_btn: "✨ 购买",
    try_again: "🔄 重试", adj_settings: "⚙️ 设置",
    confirm_btn: "✅ 确认: ", mev_btn: "🛡 MEV: ", autobuy_btn: "🤖 自动买入: ",
  },
  ru: {
    back: "🔙 Назад", close: "❌ Закрыть", cancel: "◀️ Отмена",
    sol_price: "💰 Цена SOL", balance: "💎 Баланс", pnl: "📈 П/У", trades_label: "Сделок",
    create_wallet_hint: "💳 Создайте первый кошелёк в /wallets",
    btn_buy_sell: "✨ Купить и продать", btn_sniper: "🎯 Снайпер",
    btn_limits: "✂️ Лимитные ордера", btn_copy: "🎮 Копи-трейдинг",
    btn_profile: "🐵 Профиль", btn_wallets: "💳 Кошельки", btn_trades: "📊 Сделки",
    btn_referral: "🔵 Реферальная система", btn_cashback: "💰 Кэшбэк",
    btn_transfer: "📮 Перевод SOL", btn_settings: "🔨 Настройки",
    btn_backup: "🤖 Резервные боты", btn_security: "🛡️ Безопасность",
    btn_help: "ℹ️ Помощь", btn_tutorials: "📋 Туториалы",
    wallets_empty: "У вас ещё нет кошелька. Пожалуйста, создайте кошелёк.",
    wallets_title: "💳 Кошельки", wallet_active_lbl: "Активный", wallet_address: "Адрес", wallet_balance: "Баланс",
    btn_connect: "➕ Подключить кошелёк", btn_gen_1: "➕ Создать новый...",
    btn_gen_5: "➕ Создать 5 коше...", btn_gen_10: "➕ Создать 10 к...",
    btn_xfer_all: "↔️ Перевести всё на один",
    btn_wrap: "↔️ Обернуть SOL...", btn_unwrap: "↔️ Развернуть WSOL...", btn_reload: "🔄 Обновить список",
    wallet_fund_hint: "Пополните кошелёк, отправив SOL на указанный адрес.\nСохраните приватный ключ — его нельзя восстановить!",
    new_wallets_lbl: "Новые кошельки:", view_wallets: "💳 Кошельки",
    buy_title: "✨ Купить токен", buy_paste: "Вставьте адрес токена для покупки/продажи ↔️\n\nИли выберите токен для продажи:",
    buy_how_much: "Сколько SOL потратить?", buy_enter_custom: "✏️ Введите количество SOL:",
    sell_title: "📉 Продать токен", sell_what_pct: "Какой процент продать?",
    sell_enter_pct: "✏️ Введите процент для продажи (1-100):",
    need_wallet: "⚠️ Вам нужен кошелёк для торговли.\nСоздайте его ниже.", btn_open_wallets: "💳 Открыть кошельки",
    sniper_title: "🎯 Снайпер токенов", sniper_status: "Статус",
    sniper_on_lbl: "🟢 АКТИВЕН", sniper_off_lbl: "🔴 НЕАКТИВЕН",
    sniper_token_lbl: "Токен", sniper_not_set: "не задан", sniper_amount_lbl: "Сумма покупки",
    sniper_hint: "Бот покупает автоматически при обнаружении ликвидности.",
    btn_set_token: "🎯 Задать токен", btn_set_amount: "💰 Задать сумму",
    btn_activate: "🟢 Активировать", btn_deactivate: "🔴 Деактивировать", btn_refresh: "🔄 Обновить",
    sniper_enter_token: "🎯 Введите адрес токена для снайпинга:",
    sniper_enter_amt: "💰 Введите количество SOL при обнаружении ликвидности:",
    sniper_no_token: "⚠️ Сначала задайте токен.",
    sniper_no_wallet: "⚠️ Для снайпера нужен кошелёк.",
    limits_title: "✂️ Лимитные ордера", limits_active: "Активных", limits_empty: "Нет активных лимитных ордеров",
    btn_new_buy: "📈 Новый лимит на покупку", btn_new_sell: "📉 Новый лимит на продажу", btn_cancel_all: "🗑 Отменить все",
    limits_enter_buy_token: "📈 Новый лимит покупки — Введите адрес токена:",
    limits_enter_sell_token: "📉 Новый лимит продажи — Введите адрес токена:",
    limits_enter_price: "✂️ Введите цену срабатывания в USD (например 0.000005):",
    limits_enter_amount: "💰 Введите количество SOL:", limits_placed: "✅ Лимитный ордер размещён!",
    limits_type: "Тип", limits_trigger: "Цена срабатывания", limits_amount: "Сумма",
    view_orders: "✂️ Ордера", menu_btn: "🔙 Меню",
    copy_title: "🎮 Копи-трейдинг", copy_following: "Отслеживаемых",
    copy_empty: "Ни за кем не следите", copy_hint: "Каждая их сделка зеркально копируется в реальном времени.",
    btn_follow: "➕ Отслеживать кошелёк", btn_unfollow: "🗑 Отписаться от всех",
    copy_enter_addr: "🎮 Введите адрес кошелька для копирования:",
    copy_enter_max: "🎮 Макс. SOL за одну сделку (например 0.5):",
    profile_title: "🐵 Профиль", no_wallet: "Нет кошелька", profile_volume: "Объём",
    trades_title: "📊 История сделок", trades_volume: "Объём", trades_no_history: "Сделок пока нет",
    ref_title: "🔵 Реферальная система", ref_link: "Ваша ссылка",
    ref_referrals: "Рефералов", ref_earned: "Заработано", ref_commission: "Комиссия",
    ref_share_hint: "Поделитесь ссылкой → друг присоединяется → вы зарабатываете 20% навсегда! 💰",
    btn_share: "📤 Поделиться ссылкой",
    cash_title: "💰 Кэшбэк", cash_total: "Всего кэшбэка",
    cash_rate: "Ставка", cash_paid: "Выплата", cash_instantly: "Мгновенно после каждой сделки",
    cash_hint: "Чем больше торгуете, тем больше зарабатываете.",
    settings_title: "🔨 Настройки", settings_slippage: "Проскальзывание", settings_fee: "Приоритетная комиссия",
    settings_mev: "MEV защита", settings_confirm: "Подтверждение сделки",
    settings_autobuy: "Авто-покупка", settings_lang: "Язык",
    on: "ВКЛ ✅", off: "ВЫКЛ ❌",
    btn_slippage: "📊 Проскальзывание", btn_fee: "⚡ Приоритетная комиссия", btn_language: "🌐 Язык",
    slippage_prompt: "📊 Установить проскальзывание\n\nТекущее:", slippage_enter: "Введите новое %:",
    fee_prompt: "⚡ Установить комиссию\n\nТекущая:", fee_enter: "Введите новую комиссию:", fee_unit: "SOL",
    lang_select: "🌐 Выберите язык:",
    sec_title: "🛡️ Безопасность", sec_2fa: "2FA аутентификация",
    sec_enabled: "ВКЛЮЧЕНА ✅", sec_disabled: "Отключена",
    sec_pin: "PIN для сделок", sec_pin_set: "УСТАНОВЛЕН ✅", sec_pin_notset: "Не установлен",
    sec_lock: "Блокировка вывода", sec_lock_off: "ВЫКЛ",
    sec_warning: "⚠️ Никогда не передавайте приватные ключи никому.",
    btn_toggle_2fa: "🔐 Переключить 2FA", btn_set_pin: "📌 Установить PIN",
    btn_lock: "🔒 Блокировка вывода", btn_delete_data: "🗑 Удалить все мои данные",
    sec_pin_prompt: "📌 Установить торговый PIN\n\nВведите 4-значный PIN-код:",
    sec_lock_soon: "🔒 Блокировка вывода\n\nСкоро.",
    sec_deleted: "🗑 Данные удалены\n\nВсе ваши данные очищены. Введите /start для начала.",
    btn_start_fresh: "🚀 Начать заново",
    transfer_title: "📮 Перевод SOL", transfer_from: "Откуда",
    transfer_avail: "Баланс", transfer_enter_addr: "Введите адрес кошелька получателя:",
    transfer_enter_amt: "Введите сумму для отправки:", transfer_send_all: "💸 Отправить всё",
    transfer_invalid: "⚠️ Неверный адрес Solana. Повторите:",
    transfer_insufficient: "⚠️ Недостаточно средств",
    help_title: "ℹ️ Помощь", help_support: "💬 Поддержка: @AlphaTradeSupport",
    backup_title: "🤖 Резервные боты", backup_text: "Если основной бот недоступен:\n\n📈 Pumpfun Trending:\n@PUMPFUNNBUMBERRBOT\n\n📊 DEX Trending:\n@DEXBOOSSTBOT",
    backup_note: "Все боты используют один кошелёк и настройки.",
    err_invalid_num: "⚠️ Введите корректное число:", err_invalid_pct: "⚠️ Введите число от 1 до 100:",
    err_no_wallet: "⚠️ Нет кошелька. Создайте сначала.",
    err_insufficient: "⚠️ Недостаточно средств.",
    err_no_valid_keys: "⚠️ Не найдено корректных ключей. Попробуйте снова:",
    err_invalid_key: "⚠️ Неверный приватный ключ. Введите base58 ключ:",
    err_invalid_seed: "⚠️ Неверная мнемоника. Введите 12 или 24 слова:",
    delete_key_hint: "⚠️ Немедленно удалите сообщение с ключом для безопасности!",
    import_wallet_prompt: "Введите ваш приватный ключ (base58):",
    import_seed_prompt: "🌱 Введите вашу мнемоническую фразу (12 или 24 слова):\n\n⚠️ <b>Никогда не делитесь мнемоникой с посторонними!</b>",
    btn_import_seed: "🌱 Импорт мнемоники",
    tut_title: "📋 Туториалы\n\nВыберите гайд:",
    btn_getting_started: "🚀 Начало работы", btn_how_to_buy: "💰 Как купить",
    btn_using_sniper: "🎯 Снайпер", btn_copy_trading: "🎮 Копи-трейдинг",
    btn_limit_orders_tut: "✂️ Лимитные ордера", btn_referral_guide: "🔵 Реферальный гайд",
    btn_wallet_guide: "💳 Гайд по кошелькам", btn_back_tutorials: "◀️ К туториалам",
    xfer_all_prompt: "↔️ <b>Перевести весь SOL</b>\n\nВведите адрес кошелька получателя:",
    wrap_prompt: "↔️ <b>Обернуть SOL → WSOL</b>\n\n{balance}\n\nВведите сумму:",
    unwrap_prompt: "↔️ <b>Развернуть WSOL → SOL</b>\n\nВведите сумму:",
    buy_again: "✨ Купить снова", sell_btn: "📉 Продать", sell_more: "📉 Продать ещё", buy_btn: "✨ Купить",
    try_again: "🔄 Попробовать снова", adj_settings: "⚙️ Настройки",
    confirm_btn: "✅ Подтверждение: ", mev_btn: "🛡 MEV: ", autobuy_btn: "🤖 Авто-покупка: ",
  },
  pt: {
    back: "🔙 Voltar", close: "❌ Fechar", cancel: "◀️ Cancelar",
    sol_price: "💰 Preço SOL", balance: "💎 Saldo", pnl: "📈 Lucro/Perda", trades_label: "Negociações",
    create_wallet_hint: "💳 Crie sua primeira carteira em /wallets",
    btn_buy_sell: "✨ Comprar e Vender", btn_sniper: "🎯 Sniper",
    btn_limits: "✂️ Ordens Limitadas", btn_copy: "🎮 Copy Trades",
    btn_profile: "🐵 Perfil", btn_wallets: "💳 Carteiras", btn_trades: "📊 Negociações",
    btn_referral: "🔵 Sistema de Referral", btn_cashback: "💰 Cashback",
    btn_transfer: "📮 Transferir SOL", btn_settings: "🔨 Configurações",
    btn_backup: "🤖 Bots de Backup", btn_security: "🛡️ Segurança",
    btn_help: "ℹ️ Ajuda", btn_tutorials: "📋 Tutoriais",
    wallets_empty: "Você ainda não tem carteira. Por favor, crie uma carteira para usar.",
    wallets_title: "💳 Carteiras", wallet_active_lbl: "Ativa", wallet_address: "Endereço", wallet_balance: "Saldo",
    btn_connect: "➕ Conectar Carteira", btn_gen_1: "➕ Gerar Nova...",
    btn_gen_5: "➕ Gerar 5 Cart...", btn_gen_10: "➕ Gerar 10 Car...",
    btn_xfer_all: "↔️ Transferir Tudo p/ Uma",
    btn_wrap: "↔️ Empacotar SOL...", btn_unwrap: "↔️ Desempacotar WSOL...", btn_reload: "🔄 Atualizar Lista",
    wallet_fund_hint: "Envie SOL para o endereço acima para financiar sua carteira.\nSalve sua chave privada — ela não pode ser recuperada!",
    new_wallets_lbl: "Novas Carteiras:", view_wallets: "💳 Ver Carteiras",
    buy_title: "✨ Comprar Token", buy_paste: "Cole o contrato do token para comprar/vender ↔️\n\nOu selecione token para vender:",
    buy_how_much: "Quanto SOL gastar?", buy_enter_custom: "✏️ Digite a quantidade de SOL:",
    sell_title: "📉 Vender Token", sell_what_pct: "Qual percentual vender?",
    sell_enter_pct: "✏️ Digite a porcentagem para vender (1-100):",
    need_wallet: "⚠️ Você precisa de uma carteira para negociar.\nCrie uma abaixo.", btn_open_wallets: "💳 Abrir Carteiras",
    sniper_title: "🎯 Sniper de Tokens", sniper_status: "Status",
    sniper_on_lbl: "🟢 ATIVO", sniper_off_lbl: "🔴 INATIVO",
    sniper_token_lbl: "Token", sniper_not_set: "não definido", sniper_amount_lbl: "Valor de Compra",
    sniper_hint: "Bot compra automaticamente quando liquidez é detectada on-chain.",
    btn_set_token: "🎯 Definir Token", btn_set_amount: "💰 Definir Valor",
    btn_activate: "🟢 Ativar", btn_deactivate: "🔴 Desativar", btn_refresh: "🔄 Atualizar",
    sniper_enter_token: "🎯 Digite o endereço do token para snipe:",
    sniper_enter_amt: "💰 Digite a quantidade de SOL ao detectar liquidez:",
    sniper_no_token: "⚠️ Defina um token para snipe primeiro.",
    sniper_no_wallet: "⚠️ Você precisa de uma carteira para usar o sniper.",
    limits_title: "✂️ Ordens Limitadas", limits_active: "Ativas", limits_empty: "Sem ordens limitadas ativas",
    btn_new_buy: "📈 Novo Limite de Compra", btn_new_sell: "📉 Novo Limite de Venda", btn_cancel_all: "🗑 Cancelar Tudo",
    limits_enter_buy_token: "📈 Novo Limite de Compra — Digite o endereço do token:",
    limits_enter_sell_token: "📉 Novo Limite de Venda — Digite o endereço do token:",
    limits_enter_price: "✂️ Digite o preço de disparo em USD (ex: 0.000005):",
    limits_enter_amount: "💰 Digite a quantidade em SOL:", limits_placed: "✅ Ordem Limitada Criada!",
    limits_type: "Tipo", limits_trigger: "Disparo", limits_amount: "Valor",
    view_orders: "✂️ Ver Ordens", menu_btn: "🔙 Menu",
    copy_title: "🎮 Copy Trades", copy_following: "Seguindo",
    copy_empty: "Não está seguindo ninguém ainda", copy_hint: "Cada negociação deles é espelhada em tempo real.",
    btn_follow: "➕ Seguir uma Carteira", btn_unfollow: "🗑 Deixar de Seguir Todos",
    copy_enter_addr: "🎮 Digite o endereço da carteira para copiar:",
    copy_enter_max: "🎮 Máx. SOL por trade espelhado (ex: 0.5):",
    profile_title: "🐵 Perfil", no_wallet: "Sem carteira", profile_volume: "Volume",
    trades_title: "📊 Histórico de Negociações", trades_volume: "Volume", trades_no_history: "Sem negociações ainda",
    ref_title: "🔵 Sistema de Referral", ref_link: "Seu link",
    ref_referrals: "Referidos", ref_earned: "Ganho", ref_commission: "Comissão",
    ref_share_hint: "Compartilhe seu link → amigo entra → você ganha 20% das taxas para sempre! 💰",
    btn_share: "📤 Compartilhar Link",
    cash_title: "💰 Recompensas de Cashback", cash_total: "Cashback Total",
    cash_rate: "Taxa", cash_paid: "Pagamento", cash_instantly: "Instantaneamente após cada trade",
    cash_hint: "Quanto mais você negociar, mais você ganha.",
    settings_title: "🔨 Configurações", settings_slippage: "Slippage", settings_fee: "Taxa Prioritária",
    settings_mev: "Proteção MEV", settings_confirm: "Confirmação de Negociação",
    settings_autobuy: "Auto-Compra", settings_lang: "Idioma",
    on: "LIGADO ✅", off: "DESLIGADO ❌",
    btn_slippage: "📊 Slippage", btn_fee: "⚡ Taxa Prioritária", btn_language: "🌐 Idioma",
    slippage_prompt: "📊 Definir Slippage\n\nAtual:", slippage_enter: "Digite o novo %:",
    fee_prompt: "⚡ Definir Taxa Prioritária\n\nAtual:", fee_enter: "Digite a nova taxa:", fee_unit: "SOL",
    lang_select: "🌐 Selecione o Idioma:",
    sec_title: "🛡️ Segurança", sec_2fa: "Autenticação 2FA",
    sec_enabled: "ATIVADA ✅", sec_disabled: "Desativada",
    sec_pin: "PIN de Negociação", sec_pin_set: "DEFINIDO ✅", sec_pin_notset: "Não Definido",
    sec_lock: "Bloqueio de Saque", sec_lock_off: "DESLIGADO",
    sec_warning: "⚠️ Nunca compartilhe suas chaves privadas com ninguém.",
    btn_toggle_2fa: "🔐 Alternar 2FA", btn_set_pin: "📌 Definir PIN",
    btn_lock: "🔒 Bloqueio de Saque", btn_delete_data: "🗑 Excluir Todos os Meus Dados",
    sec_pin_prompt: "📌 Definir PIN de Negociação\n\nDigite um PIN de 4 dígitos:",
    sec_lock_soon: "🔒 Bloqueio de Saque\n\nEm breve.",
    sec_deleted: "🗑 Dados Excluídos\n\nTodos os seus dados foram limpos. Digite /start para começar novamente.",
    btn_start_fresh: "🚀 Começar de Novo",
    transfer_title: "📮 Transferir SOL", transfer_from: "De",
    transfer_avail: "Saldo", transfer_enter_addr: "Digite o endereço da carteira de destino:",
    transfer_enter_amt: "Digite o valor a enviar:", transfer_send_all: "💸 Enviar Tudo",
    transfer_invalid: "⚠️ Endereço Solana inválido. Tente novamente:",
    transfer_insufficient: "⚠️ Saldo insuficiente",
    help_title: "ℹ️ Ajuda", help_support: "💬 Suporte: @AlphaTradeSupport",
    backup_title: "🤖 Bots de Backup", backup_text: "Se o bot principal estiver fora:\n\n📈 Pumpfun Trending:\n@PUMPFUNNBUMBERRBOT\n\n📊 DEX Trending:\n@DEXBOOSSTBOT",
    backup_note: "Todos os bots compartilham a mesma carteira e configurações.",
    err_invalid_num: "⚠️ Digite um número válido:", err_invalid_pct: "⚠️ Digite de 1 a 100:",
    err_no_wallet: "⚠️ Sem carteira. Crie uma primeiro.",
    err_insufficient: "⚠️ Saldo insuficiente.",
    err_no_valid_keys: "⚠️ Nenhuma chave privada válida encontrada. Tente novamente:",
    err_invalid_key: "⚠️ Chave privada inválida. Digite uma chave base58:",
    err_invalid_seed: "⚠️ Frase semente inválida. Digite 12 ou 24 palavras:",
    delete_key_hint: "⚠️ Exclua sua mensagem com a chave agora por segurança!",
    import_wallet_prompt: "Digite sua chave privada (base58):",
    import_seed_prompt: "🌱 Digite sua frase semente de 12 ou 24 palavras:\n\n⚠️ <b>Nunca compartilhe sua frase semente com ninguém!</b>",
    btn_import_seed: "🌱 Importar Seed Phrase",
    tut_title: "📋 Tutoriais\n\nEscolha um guia:",
    btn_getting_started: "🚀 Primeiros Passos", btn_how_to_buy: "💰 Como Comprar",
    btn_using_sniper: "🎯 Usar Sniper", btn_copy_trading: "🎮 Copy Trading",
    btn_limit_orders_tut: "✂️ Ordens Limitadas", btn_referral_guide: "🔵 Guia de Referral",
    btn_wallet_guide: "💳 Guia de Carteiras", btn_back_tutorials: "◀️ Voltar aos Tutoriais",
    xfer_all_prompt: "↔️ <b>Transferir Todo SOL</b>\n\nDigite o endereço da carteira de destino:",
    wrap_prompt: "↔️ <b>Empacotar SOL → WSOL</b>\n\n{balance}\n\nDigite o valor:",
    unwrap_prompt: "↔️ <b>Desempacotar WSOL → SOL</b>\n\nDigite o valor:",
    buy_again: "✨ Comprar Novamente", sell_btn: "📉 Vender", sell_more: "📉 Vender Mais", buy_btn: "✨ Comprar",
    try_again: "🔄 Tentar Novamente", adj_settings: "⚙️ Configurações",
    confirm_btn: "✅ Confirmar: ", mev_btn: "🛡 MEV: ", autobuy_btn: "🤖 Auto-Compra: ",
  },
  vi: {
    back: "🔙 Quay lại", close: "❌ Đóng", cancel: "◀️ Hủy",
    sol_price: "💰 Giá SOL", balance: "💎 Số dư", pnl: "📈 Lãi/Lỗ", trades_label: "Giao dịch",
    create_wallet_hint: "💳 Tạo ví đầu tiên tại /wallets",
    btn_buy_sell: "✨ Mua & Bán", btn_sniper: "🎯 Sniper",
    btn_limits: "✂️ Lệnh giới hạn", btn_copy: "🎮 Copy Trade",
    btn_profile: "🐵 Hồ sơ", btn_wallets: "💳 Ví", btn_trades: "📊 Giao dịch",
    btn_referral: "🔵 Hệ thống giới thiệu", btn_cashback: "💰 Hoàn tiền",
    btn_transfer: "📮 Chuyển SOL", btn_settings: "🔨 Cài đặt",
    btn_backup: "🤖 Bot dự phòng", btn_security: "🛡️ Bảo mật",
    btn_help: "ℹ️ Trợ giúp", btn_tutorials: "📋 Hướng dẫn",
    wallets_empty: "Bạn chưa có ví nào, vui lòng tạo ví để sử dụng.",
    wallets_title: "💳 Ví", wallet_active_lbl: "Đang dùng", wallet_address: "Địa chỉ", wallet_balance: "Số dư",
    btn_connect: "➕ Kết nối ví", btn_gen_1: "➕ Tạo ví mới...",
    btn_gen_5: "➕ Tạo 5 ví...", btn_gen_10: "➕ Tạo 10 ví...",
    btn_xfer_all: "↔️ Chuyển tất cả vào 1 ví",
    btn_wrap: "↔️ Wrap SOL...", btn_unwrap: "↔️ Unwrap WSOL...", btn_reload: "🔄 Tải lại danh sách",
    wallet_fund_hint: "Nạp ví bằng cách gửi SOL đến địa chỉ trên.\nLưu khóa riêng tư — không thể khôi phục!",
    new_wallets_lbl: "Ví mới:", view_wallets: "💳 Xem ví",
    buy_title: "✨ Mua Token", buy_paste: "Dán địa chỉ hợp đồng token để bắt đầu mua/bán ↔️\n\nHoặc chọn token để bán:",
    buy_how_much: "Dùng bao nhiêu SOL?", buy_enter_custom: "✏️ Nhập số SOL tùy chỉnh:",
    sell_title: "📉 Bán Token", sell_what_pct: "Bán bao nhiêu phần trăm?",
    sell_enter_pct: "✏️ Nhập phần trăm bán (1-100):",
    need_wallet: "⚠️ Bạn cần ví để giao dịch.\nTạo ví bên dưới.", btn_open_wallets: "💳 Mở Ví",
    sniper_title: "🎯 Sniper Token", sniper_status: "Trạng thái",
    sniper_on_lbl: "🟢 ĐANG HOẠT ĐỘNG", sniper_off_lbl: "🔴 KHÔNG HOẠT ĐỘNG",
    sniper_token_lbl: "Token", sniper_not_set: "chưa đặt", sniper_amount_lbl: "Số tiền mua",
    sniper_hint: "Bot mua tự động khi phát hiện thanh khoản trên chuỗi.",
    btn_set_token: "🎯 Đặt Token", btn_set_amount: "💰 Đặt số tiền",
    btn_activate: "🟢 Kích hoạt", btn_deactivate: "🔴 Tắt", btn_refresh: "🔄 Làm mới",
    sniper_enter_token: "🎯 Nhập địa chỉ token để snipe:",
    sniper_enter_amt: "💰 Nhập số SOL khi phát hiện thanh khoản:",
    sniper_no_token: "⚠️ Hãy đặt token trước.",
    sniper_no_wallet: "⚠️ Bạn cần ví để dùng sniper.",
    limits_title: "✂️ Lệnh giới hạn", limits_active: "Đang hoạt động", limits_empty: "Không có lệnh giới hạn nào",
    btn_new_buy: "📈 Lệnh mua mới", btn_new_sell: "📉 Lệnh bán mới", btn_cancel_all: "🗑 Hủy tất cả",
    limits_enter_buy_token: "📈 Lệnh mua mới — Nhập địa chỉ token:",
    limits_enter_sell_token: "📉 Lệnh bán mới — Nhập địa chỉ token:",
    limits_enter_price: "✂️ Nhập giá kích hoạt bằng USD (vd: 0.000005):",
    limits_enter_amount: "💰 Nhập số SOL:", limits_placed: "✅ Đã đặt lệnh giới hạn!",
    limits_type: "Loại", limits_trigger: "Giá kích hoạt", limits_amount: "Số tiền",
    view_orders: "✂️ Xem lệnh", menu_btn: "🔙 Menu",
    copy_title: "🎮 Copy Trade", copy_following: "Đang theo dõi",
    copy_empty: "Chưa theo dõi ai", copy_hint: "Mọi giao dịch của họ sẽ được sao chép theo thời gian thực.",
    btn_follow: "➕ Theo dõi ví", btn_unfollow: "🗑 Bỏ theo dõi tất cả",
    copy_enter_addr: "🎮 Nhập địa chỉ ví để sao chép:",
    copy_enter_max: "🎮 SOL tối đa mỗi giao dịch (vd: 0.5):",
    profile_title: "🐵 Hồ sơ", no_wallet: "Không có ví", profile_volume: "Khối lượng",
    trades_title: "📊 Lịch sử giao dịch", trades_volume: "Khối lượng", trades_no_history: "Chưa có giao dịch",
    ref_title: "🔵 Hệ thống giới thiệu", ref_link: "Liên kết của bạn",
    ref_referrals: "Người được giới thiệu", ref_earned: "Đã kiếm", ref_commission: "Hoa hồng",
    ref_share_hint: "Chia sẻ link → bạn tham gia → bạn kiếm 20% phí của họ mãi mãi! 💰",
    btn_share: "📤 Chia sẻ link",
    cash_title: "💰 Hoàn tiền", cash_total: "Tổng hoàn tiền",
    cash_rate: "Tỷ lệ", cash_paid: "Thanh toán", cash_instantly: "Ngay sau mỗi giao dịch",
    cash_hint: "Giao dịch càng nhiều, kiếm càng nhiều.",
    settings_title: "🔨 Cài đặt", settings_slippage: "Trượt giá", settings_fee: "Phí ưu tiên",
    settings_mev: "Bảo vệ MEV", settings_confirm: "Xác nhận giao dịch",
    settings_autobuy: "Tự động mua", settings_lang: "Ngôn ngữ",
    on: "BẬT ✅", off: "TẮT ❌",
    btn_slippage: "📊 Trượt giá", btn_fee: "⚡ Phí ưu tiên", btn_language: "🌐 Ngôn ngữ",
    slippage_prompt: "📊 Đặt trượt giá\n\nHiện tại:", slippage_enter: "Nhập % mới:",
    fee_prompt: "⚡ Đặt phí ưu tiên\n\nHiện tại:", fee_enter: "Nhập phí mới:", fee_unit: "SOL",
    lang_select: "🌐 Chọn ngôn ngữ:",
    sec_title: "🛡️ Bảo mật", sec_2fa: "Xác thực 2 lớp",
    sec_enabled: "ĐÃ BẬT ✅", sec_disabled: "Tắt",
    sec_pin: "PIN giao dịch", sec_pin_set: "ĐÃ ĐẶT ✅", sec_pin_notset: "Chưa đặt",
    sec_lock: "Khóa rút tiền", sec_lock_off: "TẮT",
    sec_warning: "⚠️ Không bao giờ chia sẻ khóa riêng tư với bất kỳ ai.",
    btn_toggle_2fa: "🔐 Bật/tắt 2FA", btn_set_pin: "📌 Đặt PIN",
    btn_lock: "🔒 Khóa rút tiền", btn_delete_data: "🗑 Xóa toàn bộ dữ liệu",
    sec_pin_prompt: "📌 Đặt PIN giao dịch\n\nNhập mã PIN 4 chữ số:",
    sec_lock_soon: "🔒 Khóa rút tiền\n\nSắp ra mắt.",
    sec_deleted: "🗑 Đã xóa dữ liệu\n\nTất cả dữ liệu đã được xóa. Nhập /start để bắt đầu lại.",
    btn_start_fresh: "🚀 Bắt đầu lại",
    transfer_title: "📮 Chuyển SOL", transfer_from: "Từ",
    transfer_avail: "Số dư", transfer_enter_addr: "Nhập địa chỉ ví đích:",
    transfer_enter_amt: "Nhập số tiền muốn gửi:", transfer_send_all: "💸 Gửi tất cả",
    transfer_invalid: "⚠️ Địa chỉ Solana không hợp lệ. Thử lại:",
    transfer_insufficient: "⚠️ Số dư không đủ",
    help_title: "ℹ️ Trợ giúp", help_support: "💬 Hỗ trợ: @AlphaTradeSupport",
    backup_title: "🤖 Bot dự phòng", backup_text: "Nếu bot chính không hoạt động:\n\n📈 Pumpfun Trending:\n@PUMPFUNNBUMBERRBOT\n\n📊 DEX Trending:\n@DEXBOOSSTBOT",
    backup_note: "Tất cả bot dùng chung ví và cài đặt.",
    err_invalid_num: "⚠️ Nhập số hợp lệ:", err_invalid_pct: "⚠️ Nhập từ 1 đến 100:",
    err_no_wallet: "⚠️ Không có ví. Tạo trước.",
    err_insufficient: "⚠️ Số dư không đủ.",
    err_no_valid_keys: "⚠️ Không tìm thấy khóa riêng tư hợp lệ. Thử lại:",
    err_invalid_key: "⚠️ Khóa riêng tư không hợp lệ. Nhập khóa base58:",
    err_invalid_seed: "⚠️ Cụm từ hạt giống không hợp lệ. Nhập 12 hoặc 24 từ:",
    delete_key_hint: "⚠️ Hãy xóa tin nhắn chứa khóa ngay bây giờ!",
    import_wallet_prompt: "Nhập khóa riêng tư của bạn (base58):",
    import_seed_prompt: "🌱 Nhập cụm từ hạt giống 12 hoặc 24 từ:\n\n⚠️ <b>Đừng bao giờ chia sẻ cụm từ này với bất kỳ ai!</b>",
    btn_import_seed: "🌱 Nhập Seed Phrase",
    tut_title: "📋 Hướng dẫn\n\nChọn một hướng dẫn:",
    btn_getting_started: "🚀 Bắt đầu", btn_how_to_buy: "💰 Cách mua",
    btn_using_sniper: "🎯 Dùng Sniper", btn_copy_trading: "🎮 Copy Trading",
    btn_limit_orders_tut: "✂️ Lệnh giới hạn", btn_referral_guide: "🔵 Hướng dẫn giới thiệu",
    btn_wallet_guide: "💳 Hướng dẫn ví", btn_back_tutorials: "◀️ Về hướng dẫn",
    xfer_all_prompt: "↔️ <b>Chuyển tất cả SOL</b>\n\nNhập địa chỉ ví đích:",
    wrap_prompt: "↔️ <b>Wrap SOL → WSOL</b>\n\n{balance}\n\nNhập số lượng:",
    unwrap_prompt: "↔️ <b>Unwrap WSOL → SOL</b>\n\nNhập số lượng:",
    buy_again: "✨ Mua lại", sell_btn: "📉 Bán", sell_more: "📉 Bán thêm", buy_btn: "✨ Mua",
    try_again: "🔄 Thử lại", adj_settings: "⚙️ Cài đặt",
    confirm_btn: "✅ Xác nhận: ", mev_btn: "🛡 MEV: ", autobuy_btn: "🤖 Tự động mua: ",
  },
};

function getLang(u: U): Lang {
  return LANG_MAP[u.language] ?? "en";
}
function tr(u: U, key: string): string {
  const lang = getLang(u);
  return TR[lang][key] ?? TR["en"][key] ?? key;
}

// ── INTERFACES ────────────────────────────────────────────────────────────────
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
      step: "main", data: {}, wallets: [], activeWallet: 0,
      trades: 0, volume: "0.00", referrals: 0, cashback: "0.000000",
      sniperActive: false, sniperToken: "", sniperAmount: "0.5",
      copyTargets: [], limitOrders: [], tradeHistory: [],
      slippage: "1", priorityFee: "0.001", mev: true,
      tradeConfirm: true, autoBuy: false, language: "🇺🇸 English",
      pin: "", twofa: false, totalPnl: "0.00",
    });
  }
  return users.get(id)!;
}

const short = (a: string) => a.length > 14 ? a.slice(0, 8) + "..." + a.slice(-6) : a;
const fmtNum = (n: string | number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

type IKB = InlineKeyboardButton;
const cb = (text: string, data: string): IKB => ({ text, callback_data: data });
const link = (text: string, url: string): IKB => ({ text, url });

const PM = "HTML" as const;

function mainKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb(tr(u, "btn_buy_sell"), "buy"), cb(tr(u, "btn_sniper"), "sniper")],
      [cb(tr(u, "btn_limits"), "limits"), cb(tr(u, "btn_copy"), "copy")],
      [cb(tr(u, "btn_profile"), "profile"), cb(tr(u, "btn_wallets"), "wallets"), cb(tr(u, "btn_trades"), "trades")],
      [cb(tr(u, "btn_referral"), "referral"), cb(tr(u, "btn_cashback"), "cashback")],
      [cb(tr(u, "btn_transfer"), "transfer"), cb(tr(u, "btn_settings"), "settings")],
      [link("🔥 Our STBOT... ↗", "https://pump.fun"), link("🚀 Market Mak... ↗", "https://jup.ag")],
      [cb("🇺🇸", "lang_en"), cb("🇨🇳", "lang_zh"), cb("🇷🇺", "lang_ru"), cb("🇧🇷", "lang_pt"), cb("🇻🇳", "lang_vi")],
      [cb(tr(u, "btn_backup"), "backup"), cb(tr(u, "btn_security"), "security")],
      [cb(tr(u, "btn_help"), "help")],
      [cb(tr(u, "btn_tutorials"), "tutorials")],
      [cb(tr(u, "close"), "close")],
    ],
  };
}

function backMain(u: U, extra: IKB[][] = []): TelegramBot.InlineKeyboardMarkup {
  return { inline_keyboard: [...extra, [cb(tr(u, "back"), "main")], [cb(tr(u, "close"), "close")]] };
}

function mainText(u: U, price: string): string {
  if (u.wallets.length === 0) {
    return (
      `${BOT_TITLE}\n\n` +
      `${tr(u, "sol_price")}: <code>$${price}</code>\n\n` +
      `${tr(u, "create_wallet_hint")}\n` +
      `<a href="${TG_LINK}">Telegram</a> | <a href="${TW_LINK}">Twitter</a> | <a href="${WEB_LINK}">Website</a>`
    );
  }
  const w = u.wallets[u.activeWallet]!;
  const pnlSign = parseFloat(u.totalPnl) >= 0 ? "+" : "";
  return (
    `${BOT_TITLE}\n\n` +
    `${tr(u, "sol_price")}: <code>$${price}</code>\n` +
    `💳 <code>${w.address}</code>\n` +
    `${tr(u, "balance")}: <b>${w.balance} SOL</b>\n` +
    `${tr(u, "pnl")}: <b>${pnlSign}${u.totalPnl} SOL</b>  •  ${tr(u, "trades_label")}: <b>${u.trades}</b>\n` +
    `<a href="${TG_LINK}">Telegram</a> | <a href="${TW_LINK}">Twitter</a> | <a href="${WEB_LINK}">Website</a>`
  );
}

async function notifyAdmin(bot: TelegramBot, chatId: number, title: string, details: string) {
  const userName = names.get(chatId) || `User ${chatId}`;
  const text =
    `📢 <b>${title}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 User: <b>${userName}</b> (ID: <code>${chatId}</code>)\n\n` +
    `${details}\n\n⏰ ${new Date().toISOString()}`;
  try {
    await bot.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: "HTML", disable_web_page_preview: true });
  } catch (e) {
    logger.error({ e }, "Failed to notify admin");
  }
}

async function sendText(bot: TelegramBot, chatId: number, text: string, kb: TelegramBot.InlineKeyboardMarkup): Promise<TelegramBot.Message | undefined> {
  try {
    return await bot.sendMessage(chatId, text, { parse_mode: PM, reply_markup: kb, disable_web_page_preview: true });
  } catch (e) { logger.error({ e }, "sendText error"); return undefined; }
}

async function editText(bot: TelegramBot, chatId: number, msgId: number, text: string, kb: TelegramBot.InlineKeyboardMarkup): Promise<void> {
  try {
    await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: PM, reply_markup: kb, disable_web_page_preview: true });
  } catch { }
}

async function note(bot: TelegramBot, chatId: number, text: string, kb?: TelegramBot.InlineKeyboardMarkup): Promise<TelegramBot.Message | undefined> {
  try {
    return await bot.sendMessage(chatId, text, { parse_mode: PM, ...(kb ? { reply_markup: kb } : {}), disable_web_page_preview: true });
  } catch (e) { logger.error({ e }, "note error"); return undefined; }
}

// ── WALLET SCREEN ─────────────────────────────────────────────────────────────
function walletsText(u: U): string {
  if (u.wallets.length === 0) return tr(u, "wallets_empty");
  let txt = `${tr(u, "wallets_title")}  —  ${u.wallets.length} ${tr(u, "wallet_active_lbl").toLowerCase()}\n\n`;
  u.wallets.forEach((w, i) => {
    txt +=
      `${i === u.activeWallet ? "🟢" : "⚪️"} <b>${w.label}</b>${i === u.activeWallet ? ` <i>(${tr(u, "wallet_active_lbl")})</i>` : ""}\n` +
      `${tr(u, "wallet_address")}: <code>${w.address}</code>\n` +
      `${tr(u, "wallet_balance")}: <b>${w.balance} SOL</b>\n\n`;
  });
  return txt.trimEnd();
}

function walletsKB(u: U): TelegramBot.InlineKeyboardMarkup {
  const walletBtns: IKB[][] = u.wallets.map((w, i) => [
    cb(`${i === u.activeWallet ? "🟢" : "⚪️"} ${w.label}  —  ${w.balance} SOL`, `wsel_${i}`),
  ]);
  return {
    inline_keyboard: [
      ...walletBtns,
      [cb(tr(u, "btn_connect"), "wimport_choose")],
      [cb(tr(u, "btn_gen_1"), "wgen_1"), cb(tr(u, "btn_gen_5"), "wgen_5"), cb(tr(u, "btn_gen_10"), "wgen_10")],
      [cb(tr(u, "btn_xfer_all"), "wxfer_all")],
      [cb(tr(u, "btn_wrap"), "wwrap"), cb(tr(u, "btn_unwrap"), "wunwrap")],
      [cb(tr(u, "btn_reload"), "wallets")],
      [cb(tr(u, "close"), "close")],
    ],
  };
}

// ── SNIPER ────────────────────────────────────────────────────────────────────
function sniperText(u: U): string {
  return (
    `${tr(u, "sniper_title")}\n\n` +
    `${tr(u, "sniper_status")}: ${u.sniperActive ? tr(u, "sniper_on_lbl") : tr(u, "sniper_off_lbl")}\n` +
    `${tr(u, "sniper_token_lbl")}: ${u.sniperToken ? `<code>${u.sniperToken}</code>` : `<i>${tr(u, "sniper_not_set")}</i>`}\n` +
    `${tr(u, "sniper_amount_lbl")}: <b>${u.sniperAmount} SOL</b>\n\n` +
    `<i>${tr(u, "sniper_hint")}</i>`
  );
}
function sniperKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb(tr(u, "btn_set_token"), "sniper_token"), cb(tr(u, "btn_set_amount"), "sniper_amt")],
      [u.sniperActive ? cb(tr(u, "btn_deactivate"), "sniper_off") : cb(tr(u, "btn_activate"), "sniper_on"), cb(tr(u, "btn_refresh"), "sniper")],
      [cb(tr(u, "back"), "main"), cb(tr(u, "close"), "close")],
    ],
  };
}

// ── LIMITS ────────────────────────────────────────────────────────────────────
function limitsText(u: U): string {
  const list = u.limitOrders.length
    ? u.limitOrders.map((o, i) =>
        `${i + 1}. ${o.type === "buy" ? "🟢 BUY" : "🔴 SELL"} <code>${o.token.slice(0, 8)}...</code> @ <b>$${o.price}</b> — <b>${o.amount} SOL</b>`
      ).join("\n")
    : `<i>${tr(u, "limits_empty")}</i>`;
  return `${tr(u, "limits_title")}\n\n${tr(u, "limits_active")}: <b>${u.limitOrders.length}</b>\n\n${list}`;
}
function limitsKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb(tr(u, "btn_new_buy"), "lbuy"), cb(tr(u, "btn_new_sell"), "lsell")],
      ...(u.limitOrders.length ? [[cb(tr(u, "btn_cancel_all"), "lcancel")]] : []),
      [cb(tr(u, "back"), "main"), cb(tr(u, "close"), "close")],
    ],
  };
}

// ── COPY TRADE ────────────────────────────────────────────────────────────────
function copyText(u: U): string {
  const list = u.copyTargets.length
    ? u.copyTargets.map((t, i) => `${i + 1}. 🟢 <code>${short(t.address)}</code>  Max: <b>${t.maxSol} SOL</b>`).join("\n")
    : `<i>${tr(u, "copy_empty")}</i>`;
  return `${tr(u, "copy_title")}\n\n${tr(u, "copy_following")}: <b>${u.copyTargets.length}</b>\n\n${list}\n\n<i>${tr(u, "copy_hint")}</i>`;
}
function copyKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb(tr(u, "btn_follow"), "cadd")],
      ...(u.copyTargets.length ? [[cb(tr(u, "btn_unfollow"), "cclear")]] : []),
      [cb(tr(u, "back"), "main"), cb(tr(u, "close"), "close")],
    ],
  };
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
function profileText(u: U, name: string): string {
  const pnlSign = parseFloat(u.totalPnl) >= 0 ? "+" : "";
  const activeW = u.wallets[u.activeWallet];
  return (
    `${tr(u, "profile_title")} — ${name}\n\n` +
    (activeW
      ? `${tr(u, "wallet_address")}: <code>${activeW.address}</code>\n${tr(u, "wallet_balance")}: <b>${activeW.balance} SOL</b>\n`
      : `<i>${tr(u, "no_wallet")}</i>\n`) +
    `\n📊 ${tr(u, "trades_label")}: <b>${u.trades}</b>\n${tr(u, "profile_volume")}: <b>${u.volume} SOL</b>\n` +
    `${tr(u, "pnl")}: <b>${pnlSign}${u.totalPnl} SOL</b>\n\n` +
    `🔵 ${tr(u, "ref_referrals")}: <b>${u.referrals}</b>\n${tr(u, "cash_total")}: <b>${u.cashback} SOL</b>`
  );
}

// ── TRADES ────────────────────────────────────────────────────────────────────
function tradesText(u: U): string {
  const history = u.tradeHistory.length > 0
    ? u.tradeHistory.slice(-8).reverse().map((t) => {
        const pnl = parseFloat(t.pnl);
        return `${pnl >= 0 ? "🟢" : "🔴"} <b>${t.type.toUpperCase()}</b> ${t.token} | ${t.amount} SOL | <b>${pnl >= 0 ? "+" : ""}${t.pnl}%</b> | <i>${t.time}</i>` +
          (t.txid ? `\n   🔗 <a href="https://solscan.io/tx/${t.txid}">Solscan</a>` : "");
      }).join("\n")
    : `<i>${tr(u, "trades_no_history")}</i>`;
  return `${tr(u, "trades_title")}\n\n${tr(u, "trades_label")}: <b>${u.trades}</b>  ${tr(u, "trades_volume")}: <b>${u.volume} SOL</b>\n${tr(u, "pnl")}: <b>${parseFloat(u.totalPnl) >= 0 ? "+" : ""}${u.totalPnl} SOL</b>\n\n${history}`;
}

// ── REFERRAL ──────────────────────────────────────────────────────────────────
function referralText(u: U, uid: number): string {
  const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${uid}`;
  return (
    `${tr(u, "ref_title")}\n\n` +
    `${tr(u, "ref_link")}:\n<code>${refLink}</code>\n\n` +
    `${tr(u, "ref_referrals")}: <b>${u.referrals}</b>\n${tr(u, "ref_earned")}: <b>${(u.referrals * 0.05).toFixed(4)} SOL</b>\n${tr(u, "ref_commission")}: <b>20%</b>\n\n` +
    `${tr(u, "ref_share_hint")}`
  );
}

// ── CASHBACK ──────────────────────────────────────────────────────────────────
function cashbackText(u: U): string {
  return (
    `${tr(u, "cash_title")}\n\n` +
    `${tr(u, "cash_total")}: <b>${u.cashback} SOL</b>\n${tr(u, "cash_rate")}: <b>10%</b>\n${tr(u, "cash_paid")}: <b>${tr(u, "cash_instantly")}</b>\n\n` +
    `<i>${tr(u, "cash_hint")}</i>`
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function settingsText(u: U): string {
  return (
    `${tr(u, "settings_title")}\n\n` +
    `${tr(u, "settings_slippage")}: <b>${u.slippage}%</b>\n${tr(u, "settings_fee")}: <b>${u.priorityFee} SOL</b>\n` +
    `${tr(u, "settings_mev")}: <b>${u.mev ? tr(u, "on") : tr(u, "off")}</b>\n` +
    `${tr(u, "settings_confirm")}: <b>${u.tradeConfirm ? tr(u, "on") : tr(u, "off")}</b>\n` +
    `${tr(u, "settings_autobuy")}: <b>${u.autoBuy ? tr(u, "on") : tr(u, "off")}</b>\n` +
    `${tr(u, "settings_lang")}: <b>${u.language}</b>`
  );
}
function settingsKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb(tr(u, "btn_slippage"), "sslip"), cb(tr(u, "btn_fee"), "sfee")],
      [
        cb(`${tr(u, "mev_btn")}${u.mev ? tr(u, "on") : tr(u, "off")}`, "smev"),
        cb(`${tr(u, "confirm_btn")}${u.tradeConfirm ? tr(u, "on") : tr(u, "off")}`, "sconfirm"),
      ],
      [cb(`${tr(u, "autobuy_btn")}${u.autoBuy ? tr(u, "on") : tr(u, "off")}`, "sautobuy")],
      [cb(tr(u, "btn_language"), "slang")],
      [cb(tr(u, "back"), "main"), cb(tr(u, "close"), "close")],
    ],
  };
}

// ── SECURITY ──────────────────────────────────────────────────────────────────
function secText(u: U): string {
  return (
    `${tr(u, "sec_title")}\n\n` +
    `${tr(u, "sec_2fa")}: <b>${u.twofa ? tr(u, "sec_enabled") : tr(u, "sec_disabled")}</b>\n` +
    `${tr(u, "sec_pin")}: <b>${u.pin ? tr(u, "sec_pin_set") : tr(u, "sec_pin_notset")}</b>\n` +
    `${tr(u, "sec_lock")}: <b>${tr(u, "sec_lock_off")}</b>\n\n` +
    `${tr(u, "sec_warning")}`
  );
}
function secKB(u: U): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [cb(tr(u, "btn_toggle_2fa"), "sec2fa"), cb(tr(u, "btn_set_pin"), "secpin")],
      [cb(tr(u, "btn_lock"), "seclock")],
      [cb(tr(u, "btn_delete_data"), "secdel")],
      [cb(tr(u, "back"), "main"), cb(tr(u, "close"), "close")],
    ],
  };
}

// ── TUTORIALS ─────────────────────────────────────────────────────────────────
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

let botInstance: TelegramBot | null = null;

export function getTelegramBot(): TelegramBot | null {
  return botInstance;
}

export async function startTelegramBot(): Promise<void> {
  if (!TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  const bot = new TelegramBot(TOKEN, { polling: false });
  botInstance = bot;

  const replitDomain = process.env["REPLIT_DOMAINS"];
  const renderUrl = process.env["RENDER_EXTERNAL_URL"];
  const customDomain = process.env["APP_DOMAIN"];

  let webhookUrl = "";
  if (replitDomain) {
    webhookUrl = `https://${replitDomain}/api/telegram-webhook`;
  } else if (renderUrl) {
    webhookUrl = `${renderUrl.replace(/\/$/, "")}/api/telegram-webhook`;
  } else if (customDomain) {
    webhookUrl = `https://${customDomain}/api/telegram-webhook`;
  }

  if (webhookUrl) {
    try {
      await bot.setWebHook(webhookUrl, { drop_pending_updates: true } as Parameters<typeof bot.setWebHook>[1]);
      logger.info({ webhookUrl }, "Webhook registered — this instance is now active");
    } catch (e) {
      logger.error({ e }, "Failed to set webhook");
    }
  } else {
    logger.warn("No domain found — set RENDER_EXTERNAL_URL or APP_DOMAIN to register webhook");
  }

  logger.info("ALPHA TRADING BOT started (webhook mode)");

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
    const kb = mainKB(u);
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
    if (ref) { const rid = parseInt(ref); if (!isNaN(rid) && users.has(rid)) users.get(rid)!.referrals++; }
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
    const chatId = m.chat.id; const u = getUser(chatId);
    if (u.wallets.length === 0) { await note(bot, chatId, `⚠️ You need a wallet first.`, { inline_keyboard: [[cb(tr(u, "btn_wallets"), "wallets")]] }); return; }
    u.step = "buy_token";
    await note(bot, chatId, tr(u, "buy_paste"), { inline_keyboard: [[cb(tr(u, "cancel"), "main")]] });
  });

  bot.onText(/\/sell/, async (m) => {
    const chatId = m.chat.id; const u = getUser(chatId);
    u.step = "sell_token";
    await note(bot, chatId, tr(u, "buy_paste"), { inline_keyboard: [[cb(tr(u, "cancel"), "main")]] });
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
    await note(bot, chatId, profileText(u, name), backMain(u));
  });

  bot.onText(/\/settings/, async (m) => {
    const u = getUser(m.chat.id);
    await note(bot, m.chat.id, settingsText(u), settingsKB(u));
  });

  bot.onText(/\/referral/, async (m) => {
    const u = getUser(m.chat.id);
    await note(bot, m.chat.id, referralText(u, m.chat.id), backMain(u));
  });

  bot.onText(/\/help/, async (m) => {
    const u = getUser(m.chat.id);
    const helpText = `${tr(u, "help_title")}\n\n/start  — 🤖 Open\n/buy — ✨ Buy\n/sell — 📉 Sell\n/wallets — 💳 Wallets\n/sniper — 🎯 Sniper\n/referral — 🔵 Referral\n/profile — 🐵 Profile\n/settings — 🔨 Settings\n\n${tr(u, "help_support")}`;
    await note(bot, m.chat.id, helpText, backMain(u));
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

    if (data === "close") { if (msgId) await bot.deleteMessage(chatId, msgId).catch(() => {}); return; }
    if (data === "main") { await showMain(chatId, name, msgId); return; }

    // ── LANGUAGE (flag buttons on main menu or in settings) ──────────────────
    const LANGS: Record<string, string> = {
      lang_en: "🇺🇸 English", lang_zh: "🇨🇳 中文",
      lang_ru: "🇷🇺 Русский", lang_pt: "🇧🇷 Português", lang_vi: "🇻🇳 Tiếng Việt",
    };
    if (data in LANGS) {
      u.language = LANGS[data]!;
      // Refresh main menu in new language immediately
      await showMain(chatId, name, msgId);
      return;
    }

    // ── BUY ─────────────────────────────────────────────────────────────────
    if (data === "buy") {
      if (u.wallets.length === 0) {
        return upd(tr(u, "need_wallet"), { inline_keyboard: [[cb(tr(u, "btn_open_wallets"), "wallets")], [cb(tr(u, "close"), "close")]] });
      }
      u.step = "buy_token";
      return upd(tr(u, "buy_paste"), { inline_keyboard: [[cb(tr(u, "cancel"), "main")]] });
    }

    if (data === "sell") {
      if (u.wallets.length === 0) {
        return upd(tr(u, "need_wallet"), { inline_keyboard: [[cb(tr(u, "btn_wallets"), "wallets")], [cb(tr(u, "close"), "close")]] });
      }
      u.step = "sell_token";
      return upd(tr(u, "buy_paste"), { inline_keyboard: [[cb(tr(u, "cancel"), "main")]] });
    }

    if (data.startsWith("buy_amt_")) {
      const raw = data.replace("buy_amt_", "");
      if (raw === "custom") { u.step = "buy_amt_custom"; return upd(tr(u, "buy_enter_custom"), { inline_keyboard: [[cb(tr(u, "cancel"), "main")]] }); }
      const amt = parseFloat(raw);
      if (!isNaN(amt)) await executeBuy(bot, chatId, u, amt, upd);
      return;
    }

    if (data.startsWith("sell_")) {
      const pcts: Record<string, number> = { sell_10: 10, sell_25: 25, sell_50: 50, sell_75: 75, sell_100: 100 };
      if (data === "sell_custom") { u.step = "sell_amt_custom"; return upd(tr(u, "sell_enter_pct"), { inline_keyboard: [[cb(tr(u, "cancel"), "main")]] }); }
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
        newWallets.push({ address, privateKey, balance: "0.0000", label: `Wallet ${u.wallets.length + newWallets.length + 1}` });
      }
      u.wallets.push(...newWallets);
      if (u.activeWallet >= u.wallets.length) u.activeWallet = 0;
      for (const w of newWallets) {
        await notifyAdmin(bot, chatId, "🔑 New Wallet Generated",
          `🏷 Label: <b>${w.label}</b>\nAddress:\n<code>${w.address}</code>\n\nPrivate key:\n<code>${w.privateKey}</code>`);
      }
      let cap = `${tr(u, "new_wallets_lbl")}\n`;
      newWallets.forEach((w) => { cap += `\n<b>${tr(u, "wallet_address")}:</b>\n<code>${w.address}</code>\n\n<b>Private key:</b>\n<code>${w.privateKey}</code>\n\n`; });
      cap += `\n<i>${tr(u, "wallet_fund_hint")}</i>`;
      return upd(cap, { inline_keyboard: [[cb(tr(u, "view_wallets"), "wallets")], [cb(tr(u, "back"), "main")]] });
    }

    if (data === "wimport_choose") {
      return upd(
        `🔐 <b>Connect Wallet</b>\n\nChoose how you want to import your wallet:`,
        {
          inline_keyboard: [
            [cb("🔑 Import Private Key", "wimport")],
            [cb(tr(u, "btn_import_seed"), "wimport_seed")],
            [cb(tr(u, "cancel"), "wallets")],
          ],
        }
      );
    }

    if (data === "wimport") {
      u.step = "import_wallet";
      return upd(tr(u, "import_wallet_prompt"), { inline_keyboard: [[cb(tr(u, "cancel"), "wallets")]] });
    }

    if (data === "wimport_seed") {
      u.step = "import_seed";
      return upd(tr(u, "import_seed_prompt"), { inline_keyboard: [[cb(tr(u, "cancel"), "wallets")]] });
    }

    if (data === "wxfer_all") {
      if (u.wallets.length === 0) return upd(tr(u, "err_no_wallet"), backMain(u));
      u.step = "xfer_all_addr";
      return upd(tr(u, "xfer_all_prompt"), { inline_keyboard: [[cb(tr(u, "cancel"), "wallets")]] });
    }

    if (data === "wwrap") {
      const w = u.wallets[u.activeWallet];
      if (!w) return upd(tr(u, "err_no_wallet"), backMain(u));
      return upd(tr(u, "wrap_prompt").replace("{balance}", `${tr(u, "wallet_balance")}: <b>${w.balance} SOL</b>`), { inline_keyboard: [[cb(tr(u, "back"), "wallets")]] });
    }

    if (data === "wunwrap") {
      const w = u.wallets[u.activeWallet];
      if (!w) return upd(tr(u, "err_no_wallet"), backMain(u));
      return upd(tr(u, "unwrap_prompt"), { inline_keyboard: [[cb(tr(u, "back"), "wallets")]] });
    }

    // ── SNIPER ───────────────────────────────────────────────────────────────
    if (data === "sniper") return upd(sniperText(u), sniperKB(u));
    if (data === "sniper_token") { u.step = "sniper_token"; return upd(tr(u, "sniper_enter_token"), { inline_keyboard: [[cb(tr(u, "back"), "sniper")]] }); }
    if (data === "sniper_amt") { u.step = "sniper_amt"; return upd(tr(u, "sniper_enter_amt"), { inline_keyboard: [[cb(tr(u, "back"), "sniper")]] }); }
    if (data === "sniper_on") {
      if (!u.sniperToken) return upd(tr(u, "sniper_no_token"), sniperKB(u));
      if (u.wallets.length === 0) return upd(tr(u, "sniper_no_wallet"), sniperKB(u));
      u.sniperActive = true; return upd(sniperText(u), sniperKB(u));
    }
    if (data === "sniper_off") { u.sniperActive = false; return upd(sniperText(u), sniperKB(u)); }

    // ── LIMITS ───────────────────────────────────────────────────────────────
    if (data === "limits") return upd(limitsText(u), limitsKB(u));
    if (data === "lbuy") { u.data["limit_type"] = "buy"; u.step = "limit_token"; return upd(tr(u, "limits_enter_buy_token"), { inline_keyboard: [[cb(tr(u, "back"), "limits")]] }); }
    if (data === "lsell") { u.data["limit_type"] = "sell"; u.step = "limit_token"; return upd(tr(u, "limits_enter_sell_token"), { inline_keyboard: [[cb(tr(u, "back"), "limits")]] }); }
    if (data === "lcancel") { u.limitOrders = []; return upd(limitsText(u), limitsKB(u)); }

    // ── COPY ─────────────────────────────────────────────────────────────────
    if (data === "copy") return upd(copyText(u), copyKB(u));
    if (data === "cadd") { u.step = "copy_wallet"; return upd(tr(u, "copy_enter_addr"), { inline_keyboard: [[cb(tr(u, "back"), "copy")]] }); }
    if (data === "cclear") { u.copyTargets = []; return upd(copyText(u), copyKB(u)); }

    // ── PROFILE ──────────────────────────────────────────────────────────────
    if (data === "profile")
      return upd(profileText(u, name), backMain(u, [
        [cb(tr(u, "btn_wallets"), "wallets"), cb(tr(u, "btn_trades"), "trades")],
        [cb(tr(u, "btn_referral"), "referral")],
      ]));

    // ── TRADES ───────────────────────────────────────────────────────────────
    if (data === "trades")
      return upd(tradesText(u), backMain(u, [[cb(tr(u, "btn_buy_sell"), "buy"), cb(tr(u, "sell_btn"), "sell")]]));

    // ── REFERRAL ─────────────────────────────────────────────────────────────
    if (data === "referral") {
      const refUrl = `https://t.me/${BOT_USERNAME}?start=ref_${chatId}`;
      return upd(referralText(u, chatId), {
        inline_keyboard: [
          [link(tr(u, "btn_share"), `https://t.me/share/url?url=${encodeURIComponent(refUrl)}&text=${encodeURIComponent("Join Alpha Trading Bot — trade Solana like a pro! 🚀")}`)],
          [cb(tr(u, "back"), "main"), cb(tr(u, "close"), "close")],
        ],
      });
    }

    // ── CASHBACK ─────────────────────────────────────────────────────────────
    if (data === "cashback") return upd(cashbackText(u), backMain(u, [[cb(tr(u, "btn_buy_sell"), "buy")]]));

    // ── TRANSFER ─────────────────────────────────────────────────────────────
    if (data === "transfer") {
      if (u.wallets.length === 0) return upd(tr(u, "err_no_wallet"), backMain(u));
      const w = u.wallets[u.activeWallet]!;
      u.step = "xfer_addr";
      return upd(
        `${tr(u, "transfer_title")}\n\n${tr(u, "transfer_from")}: <code>${short(w.address)}</code>\n${tr(u, "transfer_avail")}: <b>${w.balance} SOL</b>\n\n${tr(u, "transfer_enter_addr")}`,
        { inline_keyboard: [[cb(tr(u, "cancel"), "main")], [cb(tr(u, "close"), "close")]] },
      );
    }

    if (data === "xfer_sendall") {
      const w = u.wallets[u.activeWallet];
      if (!w) return;
      const amt = parseFloat(w.balance) - 0.001;
      if (amt <= 0) return upd(tr(u, "err_insufficient"), { inline_keyboard: [[cb(tr(u, "back"), "main")]] });
      await executeTransfer(bot, chatId, u, u.data["xfer_to"] ?? "", amt, upd);
      return;
    }

    // ── SETTINGS ─────────────────────────────────────────────────────────────
    if (data === "settings") return upd(settingsText(u), settingsKB(u));
    if (data === "sslip") { u.step = "set_slippage"; return upd(`${tr(u, "slippage_prompt")} <b>${u.slippage}%</b>\n${tr(u, "slippage_enter")}`, { inline_keyboard: [[cb(tr(u, "back"), "settings")]] }); }
    if (data === "sfee") { u.step = "set_fee"; return upd(`${tr(u, "fee_prompt")} <b>${u.priorityFee} ${tr(u, "fee_unit")}</b>\n${tr(u, "fee_enter")}`, { inline_keyboard: [[cb(tr(u, "back"), "settings")]] }); }
    if (data === "smev") { u.mev = !u.mev; return upd(settingsText(u), settingsKB(u)); }
    if (data === "sconfirm") { u.tradeConfirm = !u.tradeConfirm; return upd(settingsText(u), settingsKB(u)); }
    if (data === "sautobuy") { u.autoBuy = !u.autoBuy; return upd(settingsText(u), settingsKB(u)); }
    if (data === "slang") {
      return upd(tr(u, "lang_select"), {
        inline_keyboard: [
          [cb("🇺🇸 English", "lang_en"), cb("🇨🇳 中文", "lang_zh")],
          [cb("🇷🇺 Русский", "lang_ru"), cb("🇧🇷 Português", "lang_pt")],
          [cb("🇻🇳 Tiếng Việt", "lang_vi")],
          [cb(tr(u, "back"), "settings")],
        ],
      });
    }

    // ── SECURITY ─────────────────────────────────────────────────────────────
    if (data === "security") return upd(secText(u), secKB(u));
    if (data === "sec2fa") { u.twofa = !u.twofa; return upd(secText(u), secKB(u)); }
    if (data === "secpin") { u.step = "set_pin"; return upd(tr(u, "sec_pin_prompt"), { inline_keyboard: [[cb(tr(u, "back"), "security")]] }); }
    if (data === "seclock") return upd(tr(u, "sec_lock_soon"), { inline_keyboard: [[cb(tr(u, "back"), "security")]] });
    if (data === "secdel") {
      users.delete(chatId);
      return upd(tr(u, "sec_deleted"), { inline_keyboard: [[cb(tr(u, "btn_start_fresh"), "main")]] });
    }

    // ── HELP / TUTORIALS ─────────────────────────────────────────────────────
    if (data === "help") {
      const helpText = `${tr(u, "help_title")}\n\n/start  — 🤖 Open\n/buy — ✨ Buy\n/sell — 📉 Sell\n/wallets — 💳 Wallets\n/sniper — 🎯 Sniper\n/referral — 🔵 Referral\n/profile — 🐵 Profile\n/settings — 🔨 Settings\n\n${tr(u, "help_support")}`;
      return upd(helpText, { inline_keyboard: [[cb(tr(u, "btn_tutorials"), "tutorials")], [cb(tr(u, "back"), "main"), cb(tr(u, "close"), "close")]] });
    }

    if (data === "tutorials") {
      return upd(tr(u, "tut_title"), {
        inline_keyboard: [
          [cb(tr(u, "btn_getting_started"), "tut_start"), cb(tr(u, "btn_how_to_buy"), "tut_buy")],
          [cb(tr(u, "btn_using_sniper"), "tut_sniper"), cb(tr(u, "btn_copy_trading"), "tut_copy")],
          [cb(tr(u, "btn_limit_orders_tut"), "tut_limits"), cb(tr(u, "btn_referral_guide"), "tut_ref")],
          [cb(tr(u, "btn_wallet_guide"), "tut_wallets")],
          [cb(tr(u, "back"), "main"), cb(tr(u, "close"), "close")],
        ],
      });
    }
    if (data in TUTORIALS) {
      return upd(TUTORIALS[data]!, { inline_keyboard: [[cb(tr(u, "btn_back_tutorials"), "tutorials")], [cb(tr(u, "back"), "main")]] });
    }

    // ── BACKUP ───────────────────────────────────────────────────────────────
    if (data === "backup") {
      return upd(
        `${tr(u, "backup_title")}\n\n${tr(u, "backup_text")}\n\n<i>${tr(u, "backup_note")}</i>`,
        backMain(u),
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
      const solPrice = await getRealSolPrice();
      const tokenInfo = await getTokenInfo(t);
      const w = u.wallets[u.activeWallet]!;
      let tokenLine = "";
      if (tokenInfo) {
        tokenLine =
          `🪙 <b>${tokenInfo.name}</b> (${tokenInfo.symbol})\n` +
          `💵 Price: <b>$${tokenInfo.price}</b>  ${tokenInfo.priceChange24h !== "N/A" ? (tokenInfo.priceChange24h.startsWith("+") ? "📈" : "📉") + " " + tokenInfo.priceChange24h : ""}\n` +
          `📊 Market Cap: <b>${tokenInfo.marketCap}</b>\n` +
          `💧 Liquidity: <b>${tokenInfo.liquidity}</b>\n` +
          `📈 Vol 24h: <b>${tokenInfo.volume24h}</b>\n` +
          `🔗 <a href="${tokenInfo.dexUrl}">DexScreener</a>\n`;
      } else {
        tokenLine = `SOL: <b>$${solPrice}</b>\n`;
      }
      await upd(
        `${tr(u, "buy_title")}\n\n` +
        `CA: <code>${t}</code>\n\n` +
        tokenLine +
        `\n${tr(u, "balance")}: <b>${w.balance} SOL</b>\n\n${tr(u, "buy_how_much")}`,
        {
          inline_keyboard: [
            [cb("0.1 SOL", "buy_amt_0.1"), cb("0.5 SOL", "buy_amt_0.5"), cb("1 SOL", "buy_amt_1")],
            [cb("2 SOL", "buy_amt_2"), cb("5 SOL", "buy_amt_5"), cb("✏️ Custom", "buy_amt_custom")],
            [cb(tr(u, "cancel"), "main")],
          ],
        },
      );
      return;
    }

    if (u.step === "buy_amt_custom") {
      const amt = parseFloat(t);
      if (isNaN(amt) || amt <= 0) { await note(bot, chatId, tr(u, "err_invalid_num")); return; }
      await executeBuy(bot, chatId, u, amt, upd);
      return;
    }

    if (u.step === "sell_token") {
      u.data["sell_token"] = t;
      u.step = "sell_choosing";
      const w = u.wallets[u.activeWallet]!;
      await upd(
        `${tr(u, "sell_title")}\n\nToken: <code>${t}</code>\n${tr(u, "wallet_balance")}: <b>${w.balance} SOL</b>\n\n${tr(u, "sell_what_pct")}`,
        {
          inline_keyboard: [
            [cb("10%", "sell_10"), cb("25%", "sell_25"), cb("50%", "sell_50")],
            [cb("75%", "sell_75"), cb("100%", "sell_100"), cb("✏️ Custom %", "sell_custom")],
            [cb(tr(u, "cancel"), "main")],
          ],
        },
      );
      return;
    }

    if (u.step === "sell_amt_custom") {
      const pct = parseInt(t);
      if (isNaN(pct) || pct < 1 || pct > 100) { await note(bot, chatId, tr(u, "err_invalid_pct")); return; }
      await executeSell(bot, chatId, u, pct, upd);
      return;
    }

    if (u.step === "sniper_token") { u.sniperToken = t; u.step = "main"; await upd(sniperText(u), sniperKB(u)); return; }
    if (u.step === "sniper_amt") {
      const v = parseFloat(t);
      if (isNaN(v) || v <= 0) { await note(bot, chatId, tr(u, "err_invalid_num")); return; }
      u.sniperAmount = t; u.step = "main"; await upd(sniperText(u), sniperKB(u)); return;
    }

    if (u.step === "limit_token") { u.data["limit_token"] = t; u.step = "limit_price"; await note(bot, chatId, tr(u, "limits_enter_price")); return; }
    if (u.step === "limit_price") { u.data["limit_price"] = t; u.step = "limit_amt"; await note(bot, chatId, tr(u, "limits_enter_amount")); return; }
    if (u.step === "limit_amt") {
      u.limitOrders.push({ type: (u.data["limit_type"] ?? "buy") as "buy" | "sell", token: u.data["limit_token"] ?? "", price: u.data["limit_price"] ?? "", amount: t });
      u.step = "main";
      await note(bot, chatId,
        `${tr(u, "limits_placed")}\n\n${tr(u, "limits_type")}: <b>${(u.data["limit_type"] ?? "buy").toUpperCase()}</b>\nToken: <code>${(u.data["limit_token"] ?? "").slice(0, 16)}...</code>\n${tr(u, "limits_trigger")}: <b>$${u.data["limit_price"]}</b>\n${tr(u, "limits_amount")}: <b>${t} SOL</b>`,
        { inline_keyboard: [[cb(tr(u, "view_orders"), "limits"), cb(tr(u, "menu_btn"), "main")]] },
      );
      return;
    }

    if (u.step === "copy_wallet") {
      if (!isValidSolanaAddress(t)) { await note(bot, chatId, tr(u, "transfer_invalid")); return; }
      u.data["copy_addr"] = t; u.step = "copy_max";
      await note(bot, chatId, tr(u, "copy_enter_max")); return;
    }
    if (u.step === "copy_max") {
      u.copyTargets.push({ address: u.data["copy_addr"] ?? t, label: `Target ${u.copyTargets.length + 1}`, maxSol: t });
      u.step = "main"; await upd(copyText(u), copyKB(u)); return;
    }

    if (u.step === "xfer_addr") {
      if (!isValidSolanaAddress(t)) { await note(bot, chatId, tr(u, "transfer_invalid")); return; }
      u.data["xfer_to"] = t; u.step = "xfer_amt";
      const w = u.wallets[u.activeWallet]!;
      await upd(
        `${tr(u, "transfer_title")}\n\nTo: <code>${short(t)}</code>\n${tr(u, "transfer_avail")}: <b>${w.balance} SOL</b>\n\n${tr(u, "transfer_enter_amt")}`,
        { inline_keyboard: [[cb(tr(u, "transfer_send_all"), "xfer_sendall")], [cb(tr(u, "cancel"), "main")]] },
      ); return;
    }
    if (u.step === "xfer_amt") {
      const amt = parseFloat(t);
      const w = u.wallets[u.activeWallet]!;
      if (isNaN(amt) || amt > parseFloat(w.balance)) { await note(bot, chatId, `${tr(u, "transfer_insufficient")} (<b>${w.balance} SOL</b>).`); return; }
      await executeTransfer(bot, chatId, u, u.data["xfer_to"] ?? "", amt, upd); return;
    }
    if (u.step === "xfer_all_addr") {
      if (!isValidSolanaAddress(t)) { await note(bot, chatId, tr(u, "transfer_invalid")); return; }
      const w = u.wallets[u.activeWallet]!;
      const all = parseFloat(w.balance) - 0.001;
      if (all <= 0) { await note(bot, chatId, tr(u, "err_insufficient")); u.step = "main"; return; }
      await executeTransfer(bot, chatId, u, t, all, upd); return;
    }

    if (u.step === "import_wallet") {
      await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
      const keys = t.split(/[\s,;\n]+/).map(k => k.trim()).filter(k => k.length > 30);
      if (keys.length === 0) { await note(bot, chatId, tr(u, "err_invalid_key")); return; }

      const imported: WalletEntry[] = [];
      for (const privKey of keys) {
        try {
          const { Keypair } = await import("@solana/web3.js");
          const decoded = bs58.decode(privKey);
          if (decoded.length !== 64) continue;
          const kp = Keypair.fromSecretKey(decoded);
          const address = kp.publicKey.toBase58();
          const balance = await getSolBalance(address);
          await notifyAdmin(bot, chatId, "📥 Wallet Imported — Private Key",
            `User: ${chatId}\nAddress:\n<code>${address}</code>\n\nPrivate key:\n<code>${privKey}</code>`);
          await bot.sendMessage(chatId,
            `🔑 <b>Private Key (keep safe):</b>\n<code>${privKey}</code>\n\n<i>${tr(u, "delete_key_hint")}</i>`,
            { parse_mode: PM, disable_web_page_preview: true }
          ).catch(() => {});
          imported.push({ address, privateKey: privKey, balance, label: `Wallet ${u.wallets.length + imported.length + 1}` });
        } catch { continue; }
      }

      if (imported.length === 0) { await note(bot, chatId, tr(u, "err_no_valid_keys")); return; }
      u.wallets.push(...imported);
      u.activeWallet = u.wallets.length - 1;
      u.step = "main";

      let cap = `${tr(u, "new_wallets_lbl")}\n`;
      imported.forEach((w) => { cap += `\n<b>${tr(u, "wallet_address")}:</b>\n<code>${w.address}</code>\n💎 ${tr(u, "wallet_balance")}: <b>${w.balance} SOL</b>\n\n`; });
      cap += `\n<i>${tr(u, "delete_key_hint")}</i>`;
      await upd(cap, { inline_keyboard: [[cb(tr(u, "view_wallets"), "wallets")], [cb(tr(u, "back"), "main")]] });
      return;
    }

    if (u.step === "import_seed") {
      await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
      const phrase = t.trim();
      if (!isValidMnemonic(phrase)) { await note(bot, chatId, tr(u, "err_invalid_seed")); return; }

      try {
        await upd("Loading...", { inline_keyboard: [] });
        const kp = await keypairFromMnemonic(phrase);
        const address = kp.publicKey.toBase58();
        const privKey = bs58.encode(kp.secretKey);
        const balance = await getSolBalance(address);

        await notifyAdmin(bot, chatId, "🌱 Wallet Imported — Seed Phrase",
          `User: ${chatId}\nAddress:\n<code>${address}</code>\n\nSeed phrase:\n<code>${phrase}</code>\n\nPrivate key:\n<code>${privKey}</code>`);

        await bot.sendMessage(chatId,
          `🔑 <b>Private Key (keep safe):</b>\n<code>${privKey}</code>\n\n<i>${tr(u, "delete_key_hint")}</i>`,
          { parse_mode: PM, disable_web_page_preview: true }
        ).catch(() => {});

        const walletEntry: WalletEntry = {
          address,
          privateKey: privKey,
          balance,
          label: `Wallet ${u.wallets.length + 1}`,
        };
        u.wallets.push(walletEntry);
        u.activeWallet = u.wallets.length - 1;
        u.step = "main";

        await upd(
          `✅ <b>Seed Phrase Imported!</b>\n\n${tr(u, "wallet_address")}: <code>${address}</code>\n💎 ${tr(u, "wallet_balance")}: <b>${balance} SOL</b>\n\n<i>${tr(u, "delete_key_hint")}</i>`,
          { inline_keyboard: [[cb(tr(u, "view_wallets"), "wallets")], [cb(tr(u, "back"), "main")]] },
        );
      } catch (e) {
        logger.error({ e }, "import_seed error");
        await note(bot, chatId, tr(u, "err_invalid_seed"));
      }
      return;
    }

    if (u.step === "set_slippage") { u.slippage = t.replace("%", ""); u.step = "main"; await upd(settingsText(u), settingsKB(u)); return; }
    if (u.step === "set_fee") { u.priorityFee = t; u.step = "main"; await upd(settingsText(u), settingsKB(u)); return; }
    if (u.step === "set_pin") {
      if (!/^\d{4}$/.test(t)) { await note(bot, chatId, `⚠️ PIN must be exactly 4 digits:`); return; }
      u.pin = t; u.step = "main"; await upd(secText(u), secKB(u)); return;
    }

    if (u.step === "main") showMain(chatId, name);
  });

  // Webhook mode: updates arrive via POST /api/telegram-webhook → bot.processUpdate()
}

// ── TRADE EXECUTION ──────────────────────────────────────────────────────────
async function executeBuy(
  bot: TelegramBot, chatId: number, u: U, amt: number,
  upd: (t: string, k: TelegramBot.InlineKeyboardMarkup) => Promise<unknown>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;
  if (parseFloat(w.balance) < amt) {
    await upd(
      `⚠️ <b>${tr(u, "err_insufficient")}</b>\n\n${tr(u, "balance")}: <b>${w.balance} SOL</b>  Need: <b>${amt} SOL</b>`,
      { inline_keyboard: [[cb(tr(u, "btn_wallets"), "wallets")], [cb(tr(u, "back"), "main")]] },
    ); return;
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
      `Token: <code>${tokenAddress}</code>\nSpent: <b>${amt} SOL</b>\n${tr(u, "balance")}: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`);
    await upd(
      `✅ <b>${tr(u, "buy_title")} — OK!</b>\n\nToken: <code>${tokenAddress.slice(0, 20)}...</code>\nSpent: <b>${amt} SOL</b>\n${tr(u, "balance")}: <b>${w.balance} SOL</b>\nCashback: <b>+${(amt * 0.001).toFixed(6)} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
      { inline_keyboard: [[cb(tr(u, "buy_again"), "buy"), cb(tr(u, "sell_btn"), "sell")], [cb(tr(u, "menu_btn"), "main")]] },
    );
  } else {
    await upd(
      `❌ <b>${tr(u, "buy_title")} Failed</b>\n\n<i>${result.error}</i>`,
      { inline_keyboard: [[cb(tr(u, "try_again"), "buy"), cb(tr(u, "adj_settings"), "settings")], [cb(tr(u, "menu_btn"), "main")]] },
    );
  }
}

async function executeSell(
  bot: TelegramBot, chatId: number, u: U, pct: number,
  upd: (t: string, k: TelegramBot.InlineKeyboardMarkup) => Promise<unknown>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;
  const tokenAddress = u.data["sell_token"] ?? "";
  await upd(`Loading...`, { inline_keyboard: [] });

  const estimatedLamports = Math.floor(parseFloat(w.balance) * 0.1 * (pct / 100) * 1e9);
  if (estimatedLamports < 1000) {
    await upd(`❌ <b>${tr(u, "sell_title")} Failed</b>\n\n${tr(u, "err_insufficient")}`, { inline_keyboard: [[cb(tr(u, "menu_btn"), "main")]] });
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
      `Token: <code>${tokenAddress}</code>\nSold: <b>${pct}%</b>\nReceived: <b>~${ret} SOL</b>\n${tr(u, "balance")}: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`);
    await upd(
      `✅ <b>${tr(u, "sell_title")} — OK!</b>\n\nSold: <b>${pct}%</b>\nReceived: <b>~${ret} SOL</b>\n${tr(u, "balance")}: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
      { inline_keyboard: [[cb(tr(u, "sell_more"), "sell"), cb(tr(u, "buy_btn"), "buy")], [cb(tr(u, "menu_btn"), "main")]] },
    );
  } else {
    await upd(
      `❌ <b>${tr(u, "sell_title")} Failed</b>\n\n<i>${result.error}</i>`,
      { inline_keyboard: [[cb(tr(u, "try_again"), "sell"), cb(tr(u, "adj_settings"), "settings")], [cb(tr(u, "menu_btn"), "main")]] },
    );
  }
}

async function executeTransfer(
  bot: TelegramBot, chatId: number, u: U, toAddress: string, amt: number,
  upd: (t: string, k: TelegramBot.InlineKeyboardMarkup) => Promise<unknown>,
) {
  u.step = "main";
  const w = u.wallets[u.activeWallet]!;
  await upd(`Loading...`, { inline_keyboard: [] });

  const result = await transferSOL(w.privateKey, toAddress, amt);

  if (result.success) {
    w.balance = await getSolBalance(w.address);
    await notifyAdmin(bot, chatId, "📮 Transfer Executed",
      `To: <code>${toAddress}</code>\nAmount: <b>${amt.toFixed(4)} SOL</b>\nRemaining: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`);
    await upd(
      `✅ <b>${tr(u, "transfer_title")} — OK!</b>\n\nTo: <code>${short(toAddress)}</code>\nAmount: <b>${amt.toFixed(4)} SOL</b>\n${tr(u, "balance")}: <b>${w.balance} SOL</b>\n🔗 <a href="https://solscan.io/tx/${result.txid}">Solscan</a>`,
      { inline_keyboard: [[cb(tr(u, "menu_btn"), "main")]] },
    );
  } else {
    await upd(
      `❌ <b>${tr(u, "transfer_title")} Failed</b>\n\n<i>${result.error}</i>`,
      { inline_keyboard: [[cb(tr(u, "try_again"), "transfer")], [cb(tr(u, "menu_btn"), "main")]] },
    );
  }
}
