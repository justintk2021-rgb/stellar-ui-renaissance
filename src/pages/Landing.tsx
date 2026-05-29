import { useRef, lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  BarChart3,
  BookOpen,
  Shield,
  Zap,
  Target,
  ChevronRight,
  Sparkles,
  LineChart,
  Calendar,
  ClipboardList,
  NotebookPen,
  Calculator,
  Users,
  RefreshCw,
  GitCompareArrows,
  Trophy,
  Wallet,
  LayoutDashboard,
} from "lucide-react";
import logo from "@/assets/logo-3d.png";

const SpectraNoise = lazy(() =>
  import("@/components/Layout/SpectraNoise").then((m) => ({ default: m.SpectraNoise }))
);

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
  highlights,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  index: number;
  highlights?: string[];
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="group relative p-6 rounded-2xl glass border-border/40 hover:border-primary/40 shadow-xl overflow-hidden transition-colors duration-300"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5" />
      <motion.div
        whileHover={{ rotate: 8, scale: 1.08 }}
        transition={{ type: "spring", stiffness: 300 }}
        className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center mb-4 shadow-glow-sm"
      >
        <Icon className="w-6 h-6" />
      </motion.div>
      <h3 className="relative text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="relative text-muted-foreground text-sm leading-relaxed mb-3">{description}</p>
      {highlights && (
        <ul className="relative space-y-1.5">
          {highlights.map((h) => (
            <li key={h} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function StatPill({ label, value, icon: Icon, delay }: { label: string; value: string; icon: React.ElementType; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, delay, type: "spring", stiffness: 120 }}
      className="glass rounded-2xl px-5 py-4 border-border/50 shadow-xl"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: delay * 0.5 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-xl font-bold gradient-text">{value}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SectionHeader({ badge, title, subtitle }: { badge: string; title: React.ReactNode; subtitle: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeUp}
      className="text-center mb-14 max-w-3xl mx-auto"
    >
      <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium border border-primary/20 bg-primary/10 text-primary">
        <Sparkles className="w-3 h-3 mr-1.5 inline" />
        {badge}
      </Badge>
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">{title}</h2>
      <p className="text-muted-foreground text-base md:text-lg leading-relaxed">{subtitle}</p>
    </motion.div>
  );
}

const features = [
  {
    icon: LayoutDashboard,
    title: "Performance Dashboard",
    description: "Your command center for trading performance — live stats, equity curves, and actionable insights at a glance.",
    highlights: ["Balance & equity cards with sparklines", "Net P&L, profit factor, avg win/loss", "Trading Intelligence Map by pair & session"],
  },
  {
    icon: BookOpen,
    title: "Trade Journal",
    description: "Log every trade with rich detail. Filter by win/loss, date range, or account and never lose track of your edge.",
    highlights: ["Add, edit & delete trades with full metadata", "Mini calendar with daily P&L dots", "One-click jump to linked notebook notes"],
  },
  {
    icon: GitCompareArrows,
    title: "Period Comparison",
    description: "Compare two time periods side-by-side to spot what's improving and what's slipping in your performance.",
    highlights: ["Month-over-month delta metrics", "Compare by account, tag, or asset", "Shareable comparison URLs"],
  },
  {
    icon: ClipboardList,
    title: "Strategy Playbook",
    description: "Build rule-based checklists that keep you disciplined. Attach them to trades and track compliance over time.",
    highlights: ["Fixed & conditional checklist items", "Per-checklist win rate & P&L stats", "Drag-reorder with percentage weighting"],
  },
  {
    icon: NotebookPen,
    title: "Rich Notebook",
    description: "A full trading notebook with categories, folders, rich text, and 50 fonts — your second brain for the markets.",
    highlights: ["Trade Notes, Daily Journal, Plans & Goals", "Pin, lock, share & export entries", "Link notes directly to trades"],
  },
  {
    icon: RefreshCw,
    title: "Broker Sync",
    description: "Connect TradeLocker or Myfxbook to auto-sync balances, equity, and positions — or import via CSV.",
    highlights: ["Live balance & floating P&L via realtime", "Auto-sync every 5 minutes", "Position management & order tools"],
  },
  {
    icon: Calendar,
    title: "P&L Calendar",
    description: "A heatmap-style calendar that color-codes your trading days so patterns jump off the screen.",
    highlights: ["Green/red/flat day visualization", "Click any day for trades & notes", "Inline trade entry from calendar"],
  },
  {
    icon: Trophy,
    title: "Trader Rank System",
    description: "Gamified progression from Novice to Legend based on consistency, checklist usage, win rate, and streaks.",
    highlights: ["Rank badge displayed in your dashboard", "Tracks journaling consistency", "Motivates daily improvement"],
  },
  {
    icon: Calculator,
    title: "Lot Size Calculator",
    description: "Calculate position size across 80+ instruments — forex, indices, stocks, crypto, and commodities.",
    highlights: ["Risk % and stop-loss based sizing", "Animated result display", "Covers all major asset classes"],
  },
  {
    icon: LineChart,
    title: "Interactive Charts",
    description: "Professional TradingView charts with symbol search, light/dark themes, and fullscreen mode.",
    highlights: ["Advanced charting embed", "Drawing tools & technical analysis", "Theme synced with your preferences"],
  },
  {
    icon: Users,
    title: "Community",
    description: "Connect with other traders through channel-based chat, DMs, reactions, and image sharing.",
    highlights: ["Real-time messaging via Supabase", "Threaded replies & emoji reactions", "Direct messages between users"],
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your trading data is encrypted and stored securely. ATP • Private — built for traders who value discretion.",
    highlights: ["Row-level security on all data", "Multi-account isolation", "Customizable accent themes"],
  },
];

const workflow = [
  { step: "01", title: "Connect & Log", desc: "Link your broker or import trades. Every session starts with a complete record." },
  { step: "02", title: "Analyze & Compare", desc: "Use the dashboard and comparison tools to find your edge and weak spots." },
  { step: "03", title: "Refine & Rank Up", desc: "Follow your playbook, journal in the notebook, and climb the trader ranks." },
];

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [spectraPaused, setSpectraPaused] = useState(false);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.96]);

  useEffect(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSpectraPaused(!entry.isIntersecting),
      { rootMargin: "100px" }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-foreground overflow-x-hidden">
      {/* SpectraNoise — bending spectral light ribbon */}
      <Suspense fallback={<div className="fixed inset-0 z-0 bg-black" aria-hidden />}>
        <SpectraNoise paused={spectraPaused} />
      </Suspense>

      {/* Navigation */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between glass-strong rounded-2xl px-4 sm:px-6 py-3 border-border/50">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src={logo} alt="NSYNC" loading="lazy" className="w-9 h-9 rounded-xl group-hover:scale-105 transition-transform" />
            <span className="text-lg font-bold hidden sm:inline">NSYNC Journal</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#integrations" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Integrations
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="secondary" className="hidden lg:inline-flex text-[10px] text-muted-foreground">
              ATP • Private
            </Badge>
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Login
              </Button>
            </Link>
            <Link to="/auth">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button size="sm" className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-glow-sm font-semibold">
                  Sign Up
                  <Sparkles className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center justify-center pt-28 pb-20 px-4 sm:px-6"
      >
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-primary/30 text-primary text-sm font-medium mb-8"
            >
              <Zap className="w-4 h-4" />
              Elevate Your Trading Game
            </motion.div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight"
          >
            Master Your{" "}
            <span className="gradient-text">Trading Journey</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            The all-in-one trading journal built for serious traders. Track performance, follow your playbook,
            sync your broker, and level up with data-driven insights.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/auth">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" className="text-base px-8 py-6 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-glow rounded-2xl font-semibold animate-pulse-glow">
                  Start Journaling Free
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </motion.div>
            </Link>
            <a href="#features">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button variant="outline" size="lg" className="text-base px-8 py-6 rounded-2xl border-border/60 bg-card/40 backdrop-blur-sm hover:bg-card/60">
                  Explore Features
                </Button>
              </motion.div>
            </a>
          </motion.div>

          {/* Floating stats */}
          <div className="hidden lg:grid grid-cols-4 gap-4 mt-20 max-w-4xl mx-auto">
            <StatPill label="Win Rate Tracking" value="Real-time" icon={TrendingUp} delay={0.9} />
            <StatPill label="Instruments" value="80+" icon={BarChart3} delay={1.0} />
            <StatPill label="Broker Sync" value="Live" icon={RefreshCw} delay={1.1} />
            <StatPill label="Trader Ranks" value="10 Levels" icon={Trophy} delay={1.2} />
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-primary/40 flex items-start justify-center p-2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Quick highlights */}
      <section className="relative z-10 py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Wallet, label: "Multi-Account", desc: "Track multiple accounts" },
            { icon: Target, label: "Playbook", desc: "Rule-based checklists" },
            { icon: BarChart3, label: "Analytics", desc: "Deep performance stats" },
            { icon: Shield, label: "Private", desc: "Your data, encrypted" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="glass rounded-2xl p-5 text-center border-border/40 hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            badge="Powerful Features"
            title={
              <>
                Everything You Need to{" "}
                <span className="gradient-text">Trade Smarter</span>
              </>
            }
            subtitle="A comprehensive suite of tools designed to help you analyze, learn, and improve your trading consistently — all in one private journal."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            badge="How It Works"
            title={
              <>
                From First Trade to{" "}
                <span className="gradient-text">Consistent Edge</span>
              </>
            }
            subtitle="Three steps to transform how you track, analyze, and improve your trading performance."
          />

          <div className="grid md:grid-cols-3 gap-6">
            {workflow.map((item, i) => (
              <motion.div
                key={item.step}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="relative glass rounded-2xl p-6 border-border/40 text-center"
              >
                <span className="text-4xl font-bold gradient-text opacity-80">{item.step}</span>
                <h3 className="text-lg font-semibold mt-3 mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                {i < workflow.length - 1 && (
                  <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-primary/40" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="relative z-10 py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="glass-strong rounded-3xl p-8 md:p-12 border-border/50 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/20">
                  <RefreshCw className="w-3 h-3 mr-1.5 inline" />
                  Broker Integrations
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  Sync Your Accounts{" "}
                  <span className="gradient-text">Automatically</span>
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Connect TradeLocker or Myfxbook to pull live balances, equity, and open positions.
                  Prefer manual control? Import trades via CSV or log them by hand — your journal adapts to your workflow.
                </p>
                <ul className="space-y-3">
                  {["TradeLocker live sync with realtime updates", "Myfxbook account integration", "CSV import for any broker", "Manual multi-account management"].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <ChevronRight className="w-3 h-3 text-primary" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: RefreshCw, label: "Auto Sync", value: "Every 5 min" },
                  { icon: Wallet, label: "Accounts", value: "Unlimited" },
                  { icon: LineChart, label: "Live P&L", value: "Realtime" },
                  { icon: BarChart3, label: "Import", value: "CSV + API" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="stat-gradient rounded-2xl p-5 border border-border/30 text-center"
                  >
                    <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="font-bold text-sm mt-0.5">{stat.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-5">
            Ready to Transform{" "}
            <span className="gradient-text">Your Trading?</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Join traders who use NSYNC Journal to track every trade, follow their playbook, and climb the ranks.
            Sign up free — use Google or email.
          </p>
          <Link to="/auth">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Button size="lg" className="text-lg px-10 py-7 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-glow rounded-2xl font-semibold">
                Get Started Free
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="NSYNC" loading="lazy" className="w-8 h-8 rounded-lg" />
            <span className="font-bold">NSYNC Journal</span>
            <Badge variant="secondary" className="text-[10px] text-muted-foreground ml-1">
              ATP • Private
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} NSYNC Journal. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
