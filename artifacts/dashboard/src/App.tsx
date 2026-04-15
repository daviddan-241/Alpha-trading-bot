import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchInterval: 5000 } } });

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = BASE.replace("/dashboard", "") + "/api";

interface BotStats {
  totalUsers: number;
  totalWallets: number;
  totalTrades: number;
  totalVolume: string;
  topWallets: { address: string; balance: string; label: string; userId: number }[];
  recentTrades: { type: string; token: string; amount: string; pnl: string; time: string; txid?: string; userId: number }[];
  globalWalletIndex: number;
}

function useBotStats() {
  return useQuery<BotStats>({
    queryKey: ["botStats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/stats`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

const MOCK_VOLUME_DATA = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  volume: Math.random() * 50 + 5,
  trades: Math.floor(Math.random() * 20 + 1),
}));

const BOT_NAMES = ["Agamemnon", "Nestor", "Odysseus", "Menelaus", "Diomedes", "Paris", "Helenus", "Hector"];

function short(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function NavItem({ label, icon, path, active, onClick }: { label: string; icon: string; path: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-primary/15 text-primary border border-primary/30"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Overview({ stats }: { stats?: BotStats }) {
  const totalUsers = stats?.totalUsers ?? 0;
  const totalWallets = stats?.totalWallets ?? 0;
  const totalTrades = stats?.totalTrades ?? 0;
  const totalVolume = stats?.totalVolume ?? "0.0000";
  const globalIdx = stats?.globalWalletIndex ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">Real-time Alpha Trading Bot statistics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={totalUsers} sub="Active bot users" icon="👥" color="text-primary" />
        <StatCard label="Total Wallets" value={totalWallets} sub={`${globalIdx} generated`} icon="💳" color="text-blue-400" />
        <StatCard label="Total Trades" value={totalTrades} sub="All time" icon="📊" color="text-yellow-400" />
        <StatCard label="Volume (SOL)" value={totalVolume} sub="All time volume" icon="💰" color="text-green-400" />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">24h Volume (SOL)</h3>
          <span className="text-xs text-muted-foreground">Simulated preview</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={MOCK_VOLUME_DATA}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(168,100%,42%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(168,100%,42%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
            <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <RTooltip contentStyle={{ background: "hsl(222,20%,11%)", border: "1px solid hsl(217,20%,18%)", borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="volume" stroke="hsl(168,100%,42%)" fill="url(#volGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">Bot Instances</h3>
          <div className="space-y-2">
            {BOT_NAMES.map((name, i) => (
              <div key={name} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full pulse-green ${i < 3 ? "bg-primary" : "bg-muted-foreground"}`} />
                  <span className="text-sm font-medium">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {i < 3 ? "Active" : "Idle"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">Hourly Trade Count</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={MOCK_VOLUME_DATA.slice(0, 12)}>
              <XAxis dataKey="hour" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} width={25} />
              <RTooltip contentStyle={{ background: "hsl(222,20%,11%)", border: "1px solid hsl(217,20%,18%)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="trades" radius={[3, 3, 0, 0]}>
                {MOCK_VOLUME_DATA.slice(0, 12).map((_, idx) => (
                  <Cell key={idx} fill={`hsl(168,100%,${30 + idx * 2}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Wallets({ stats }: { stats?: BotStats }) {
  const wallets = stats?.topWallets ?? [];
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Top Wallets</h2>
        <p className="text-sm text-muted-foreground mt-1">Highest balance wallets across all users</p>
      </div>

      {wallets.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">💳</div>
          <p className="text-muted-foreground">No wallets yet. Users will appear here once they connect to the bot.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <div>#</div><div>Label</div><div>Address</div><div className="text-right">Balance (SOL)</div>
          </div>
          {wallets.map((w, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
              <div className="text-muted-foreground text-sm">{i + 1}</div>
              <div className="text-sm font-medium">{w.label}</div>
              <button
                onClick={() => copy(w.address)}
                className="text-sm font-mono text-primary hover:text-primary/80 transition-colors text-left"
                title={w.address}
              >
                {copied === w.address ? "✓ Copied!" : short(w.address)}
              </button>
              <div className="text-right text-sm font-medium text-green-400">{parseFloat(w.balance).toFixed(4)} SOL</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Trades({ stats }: { stats?: BotStats }) {
  const trades = stats?.recentTrades ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Recent Trades</h2>
        <p className="text-sm text-muted-foreground mt-1">Latest buy/sell activity across all users</p>
      </div>

      {trades.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-muted-foreground">No trades yet. Trades will appear here as users buy and sell tokens.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <div>Type</div><div>Token</div><div>Amount</div><div>P&amp;L</div><div className="text-right">Time</div>
          </div>
          {trades.map((t, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors items-center">
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.type === "buy" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                  {t.type?.toUpperCase()}
                </span>
              </div>
              <div className="text-sm font-mono">{short(t.token)}</div>
              <div className="text-sm">{t.amount} SOL</div>
              <div className={`text-sm font-medium ${t.pnl?.startsWith("-") ? "text-destructive" : "text-green-400"}`}>
                {t.pnl || "–"}
              </div>
              <div className="text-right text-xs text-muted-foreground">{t.time || "–"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Bot Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">Read-only view of current bot settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { label: "Bot Username", value: "@Alphacircletrading_bot", icon: "🤖" },
          { label: "Network", value: "Solana Mainnet", icon: "🌐" },
          { label: "Default Fee Mode", value: "Fast (0.001 SOL)", icon: "⚡" },
          { label: "Default Slippage", value: "1%", icon: "📉" },
          { label: "MEV Protection", value: "Enabled", icon: "🛡️" },
          { label: "Auto Buy", value: "Disabled", icon: "🤖" },
          { label: "Sell Protection", value: "Disabled", icon: "🔒" },
          { label: "Advanced Mode", value: "Disabled", icon: "⚙️" },
        ].map(item => (
          <div key={item.label} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
            <span className="text-sm font-medium text-foreground">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4">Referral System</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Tier 1 (Direct referrals)</span>
            <span className="text-primary font-medium">25% cashback</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Tier 2 (Referral of referrals)</span>
            <span className="text-primary font-medium">10% cashback</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Tier 3 (Deep referrals)</span>
            <span className="text-primary font-medium">5% cashback</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { label: "Overview", icon: "📊", path: "/" },
  { label: "Wallets", icon: "💳", path: "/wallets" },
  { label: "Trades", icon: "📈", path: "/trades" },
  { label: "Settings", icon: "⚙️", path: "/settings" },
];

function Dashboard() {
  const [location, setLocation] = useLocation();
  const { data: stats, isLoading } = useBotStats();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-sm">⚡</div>
            <div>
              <div className="text-sm font-bold text-foreground leading-tight">Alpha Bot</div>
              <div className="text-[10px] text-muted-foreground">Trading Dashboard</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.path}
              label={item.label}
              icon={item.icon}
              path={item.path}
              active={location === item.path || (item.path === "/" && location === "")}
              onClick={() => setLocation(item.path)}
            />
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="bg-secondary rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary pulse-green" />
              <span className="text-xs font-medium text-primary">Bot Online</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">{now.toLocaleTimeString()}</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="text-foreground font-medium">
              {NAV_ITEMS.find(n => n.path === location || (n.path === "/" && location === ""))?.label ?? "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isLoading && (
              <span className="text-xs text-muted-foreground animate-pulse">Syncing...</span>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Live</span>
            </div>
          </div>
        </header>

        <div className="p-6">
          <Switch>
            <Route path="/" component={() => <Overview stats={stats} />} />
            <Route path="/wallets" component={() => <Wallets stats={stats} />} />
            <Route path="/trades" component={() => <Trades stats={stats} />} />
            <Route path="/settings" component={() => <Settings />} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Dashboard />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
