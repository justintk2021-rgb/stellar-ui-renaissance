import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  BarChart3,
  BookOpen,
  Shield,
  ChevronRight,
  Calendar,
  ClipboardList,
  NotebookPen,
  RefreshCw,
  Trophy,
  Wallet,
  LayoutDashboard,
  Check,
  Quote,
} from "lucide-react";
import logo from "@/assets/logo-3d.png";
import dashboardShot from "@/assets/landing-screenshots/dashboard.png";
import settingsBrokersShot from "@/assets/landing-screenshots/settings-brokers.png";
import { cn } from "@/lib/utils";

const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: i * 0.07, ease: easeOut },
  }),
};

const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -48 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 48 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.75, ease: easeOut },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.12 },
  },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: easeOut },
  },
};

const listItem: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.45, ease: easeOut },
  },
};

const navLinks = [
  { href: "#overview", label: "Overview" },
  { href: "#benefits", label: "Benefits" },
  { href: "#features", label: "Features" },
  { href: "#integrations", label: "Integrations" },
];

const trustItems = ["TradeLocker", "Myfxbook", "MetaTrader 5", "CSV Import", "Multi-Account"];

const spotlightSections = [
  {
    eyebrow: "Performance dashboard",
    eyebrowAlt: "Market access",
    title: "Instant clarity on every trade you take",
    description:
      "See balance, equity, net P&L, and win rate in one command center. Your edge is easier to find when the numbers are always in view.",
    icon: LayoutDashboard,
    reverse: false,
  },
  {
    eyebrow: "Trade journal",
    eyebrowAlt: "Actionable data",
    title: "Data that drives smarter journal decisions",
    description:
      "Log every trade with rich detail, filter by win/loss or date, and jump to linked notes. Your full history stays organized in one place.",
    icon: BookOpen,
    reverse: true,
  },
  {
    eyebrow: "Broker sync",
    eyebrowAlt: "Live updates",
    title: "Effortless sync and real-time position tracking",
    description:
      "Connect TradeLocker, Myfxbook, or MT5 and keep balances, equity, and open positions up to date — or import via CSV on your terms.",
    icon: RefreshCw,
    reverse: false,
  },
];

const featureCards = [
  {
    icon: TrendingUp,
    title: "Real-time P&L",
    description: "Track daily results with a heatmap calendar and live stats that update as you trade.",
    metrics: ["Live stats", "Daily dots"],
  },
  {
    icon: ClipboardList,
    title: "Strategy playbook",
    description: "Rule-based checklists keep you disciplined and show compliance over time.",
    metrics: ["Win rate by rule", "Weighted items"],
  },
  {
    icon: Shield,
    title: "Private & secure",
    description: "Row-level security and encrypted storage built for traders who value discretion.",
    metrics: ["RLS enabled", "Multi-account"],
  },
  {
    icon: NotebookPen,
    title: "Rich notebook",
    description: "Categories, folders, rich text, and dozens of fonts for plans, journals, and trade notes.",
    metrics: ["50+ fonts", "Trade links"],
  },
  {
    icon: Trophy,
    title: "Trader ranks",
    description: "Progress from Novice to Legend based on consistency, journaling, and performance.",
    metrics: ["10 levels", "Daily streaks"],
  },
  {
    icon: BarChart3,
    title: "Deep analytics",
    description: "Equity curves, profit factor, intelligence maps by pair and session — all in one place.",
    metrics: ["80+ symbols", "Period compare"],
  },
];

const steps = [
  { step: "1", title: "Create your account", desc: "Sign up free with Google or email in seconds." },
  { step: "2", title: "Connect or import", desc: "Link a broker, MT5 bridge, or upload trades via CSV." },
  { step: "3", title: "Log and organize", desc: "Journal trades, attach playbooks, and write in the notebook." },
  { step: "4", title: "Analyze and improve", desc: "Use dashboards, comparison tools, and ranks to refine your edge." },
];

function ProductScreenshot({
  src,
  alt,
  size = "side",
  animateOnLoad = false,
  slideFrom = "bottom",
  style,
}: {
  src: string;
  alt: string;
  size?: "hero" | "side";
  animateOnLoad?: boolean;
  slideFrom?: "bottom" | "right";
  style?: React.CSSProperties;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const hidden =
    slideFrom === "right"
      ? { opacity: 0, x: 56, scale: 0.9 }
      : { opacity: 0, y: 56, scale: 0.92 };

  return (
    <motion.div
      className={cn(
        "group relative rounded-2xl border border-border/70 bg-muted/40 p-1.5 shadow-lg ring-1 ring-black/5",
        size === "hero" ? "max-w-4xl mx-auto" : "max-w-md md:max-w-none md:ml-auto",
      )}
      style={style}
      initial={hidden}
      {...(animateOnLoad
        ? { animate: { opacity: 1, x: 0, y: 0, scale: 1 } }
        : { whileInView: { opacity: 1, x: 0, y: 0, scale: 1 }, viewport: { once: true, margin: "-80px" } })}
      transition={{ duration: 0.85, ease: easeOut }}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.02 }}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className={cn(
            "rounded-xl overflow-hidden bg-[#0a0a0a] ring-1 ring-primary/10",
            size === "hero" ? "max-h-[min(420px,55vh)]" : "max-h-[260px] md:max-h-[300px]",
          )}
        >
          <motion.img
            src={src}
            alt={alt}
            className="w-full h-full object-cover object-top block"
            loading="lazy"
            decoding="async"
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: easeOut }}
          />
        </div>
      </motion.div>
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-60"
        aria-hidden
      />
    </motion.div>
  );
}

function FeatureVisual({ icon: Icon, reverse }: { icon: React.ElementType; reverse?: boolean }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <motion.div
      className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-muted/60 to-card p-10 min-h-[220px] md:min-h-[260px] flex items-center justify-center max-w-md md:max-w-none md:ml-auto overflow-hidden"
      variants={reverse ? fadeInLeft : fadeInRight}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      whileHover={reduceMotion ? undefined : { scale: 1.03, y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.08),transparent_70%)]"
        animate={reduceMotion ? undefined : { opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-glow-sm"
        animate={reduceMotion ? undefined : { rotate: [0, 4, -4, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="w-10 h-10 text-primary" strokeWidth={1.25} />
      </motion.div>
    </motion.div>
  );
}

export default function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroImageY = useTransform(scrollYProgress, [0, 1], [0, 72]);
  const heroImageScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const heroImageOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.55]);
  const navShadow = useTransform(scrollYProgress, [0, 0.08], [0, 1]);
  const navBoxShadow = useTransform(navShadow, (v) => `0 4px 24px hsl(0 0% 0% / ${v * 0.06})`);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    return () => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-sans scroll-smooth">
      {/* Nav — Crypton-style sticky bar */}
      <motion.header
        className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md"
        style={{ boxShadow: navBoxShadow }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="NSYNC" className="w-8 h-8 rounded-lg" loading="lazy" />
            <span className="font-semibold text-[15px] tracking-tight">NSYNC Journal</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/auth" className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-2">
              Contact
            </Link>
            <Link to="/auth">
              <Button size="sm" className="rounded-full px-5 font-medium shadow-sm">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero */}
      <section
        ref={heroRef}
        id="overview"
        className="relative pt-16 pb-20 md:pt-24 md:pb-28 px-4 sm:px-6 overflow-hidden"
      >
        <motion.div
          className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 w-[min(900px,90vw)] h-[400px] rounded-full bg-primary/5 blur-3xl"
          animate={{ opacity: [0.3, 0.55, 0.3], scale: [1, 1.08, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <Badge
              variant="secondary"
              className="mb-6 rounded-full px-4 py-1.5 text-xs font-medium border border-border bg-muted/50 text-muted-foreground"
            >
              ATP • Private trading journal
            </Badge>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            custom={1}
            variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.08] mb-6 text-foreground"
          >
            Leading platform for{" "}
            <span className="gradient-text">serious traders</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
            className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Your trades, streamlined. NSYNC delivers performance dashboards, broker sync, playbooks,
            and a rich notebook — built to the highest standard for modern journaling.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/auth">
              <Button size="lg" className="rounded-full px-8 h-12 text-base font-semibold shadow-md">
                Start for free
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </motion.div>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={4}
            variants={fadeUp}
            className="mt-10 text-xs uppercase tracking-widest text-muted-foreground"
          >
            Works with
          </motion.p>
          <motion.div
            initial="hidden"
            animate="visible"
            custom={5}
            variants={fadeUp}
            className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-foreground/80"
          >
            {trustItems.map((item, i) => (
              <motion.span
                key={item}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + i * 0.06, duration: 0.4 }}
              >
                {item}
              </motion.span>
            ))}
          </motion.div>

          <motion.div
            className="mt-14 md:mt-16"
            style={{ y: heroImageY, scale: heroImageScale, opacity: heroImageOpacity }}
          >
            <ProductScreenshot
              src={dashboardShot}
              alt="NSYNC Journal dashboard with balance, P&L calendar, and performance stats"
              size="hero"
              animateOnLoad
              slideFrom="bottom"
            />
          </motion.div>
        </div>
      </section>

      {/* Intro band */}
      <section className="py-16 md:py-20 px-4 sm:px-6 border-y border-border/50 bg-muted/30">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={scaleIn}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
            Redefining how you track and improve
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            Harness a trading journal built to industry standards — dashboards, sync, playbooks,
            and analytics in one conversion-ready workspace.
          </p>
        </motion.div>
      </section>

      {/* Alternating spotlight sections */}
      <div id="benefits">
        {spotlightSections.map((section, i) => (
          <section key={section.title} className="py-20 md:py-28 px-4 sm:px-6">
            <div
              className={`max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center ${
                section.reverse ? "md:[&>div:first-child]:order-2" : ""
              }`}
            >
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={section.reverse ? fadeInRight : fadeInLeft}
              >
                <p className="text-sm font-medium text-primary mb-1">{section.eyebrow}</p>
                <p className="text-xs text-muted-foreground mb-4">{section.eyebrowAlt}</p>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 leading-snug">
                  {section.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-8 max-w-md">{section.description}</p>
                <Link to="/auth">
                  <Button variant="outline" className="rounded-full px-6 border-border hover:bg-muted/50">
                    Get started
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </motion.div>
              <FeatureVisual icon={section.icon} reverse={section.reverse} />
            </div>
          </section>
        ))}
      </div>

      {/* Feature grid */}
      <section id="features" className="py-20 md:py-28 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
              Powerful features built for trading confidence
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Stay secure, informed, and in control — every step of your journey.
            </p>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            {featureCards.map((card) => (
              <motion.div
                key={card.title}
                variants={staggerChild}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm hover:shadow-lg hover:border-primary/25 transition-colors duration-300"
              >
                <motion.div
                  className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4"
                  whileHover={{ rotate: 8, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <card.icon className="w-5 h-5 text-primary" />
                </motion.div>
                <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{card.description}</p>
                <div className="flex flex-wrap gap-2">
                  {card.metrics.map((m) => (
                    <span
                      key={m}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/60"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 md:py-28 px-4 sm:px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
              Simple steps to smarter trading
            </h2>
            <p className="text-muted-foreground">
              Get started in minutes. From signup to your first synced trade, everything is built for speed and clarity.
            </p>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
          >
            {steps.map((item) => (
              <motion.div
                key={item.step}
                variants={staggerChild}
                whileHover={{ y: -6 }}
                className="text-center p-6 rounded-2xl border border-border/60 bg-card"
              >
                <motion.span
                  className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold mb-4"
                  whileInView={{ scale: [0.5, 1.15, 1] }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  {item.step}
                </motion.span>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Link to="/auth">
              <Button size="lg" className="rounded-full px-8">
                Create account
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-20 md:py-28 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeInLeft}
          >
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Invest without guesswork
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Leverage automation and data-driven insights. Connect brokers, import CSVs, or log manually —
              your journal adapts to how you work.
            </p>
            <motion.ul
              className="space-y-3"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[
                "TradeLocker live sync with realtime updates",
                "Myfxbook and MT5 bridge support",
                "CSV import for any broker",
                "Multi-account management",
              ].map((item) => (
                <motion.li key={item} variants={listItem} className="flex items-start gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {item}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
          <ProductScreenshot
            src={settingsBrokersShot}
            alt="Connect TradeLocker, Myfxbook, or MetaTrader 5"
            slideFrom="right"
          />
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={scaleIn}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-10">What traders say</h2>
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          >
            <Quote className="w-8 h-8 text-primary/40 mx-auto mb-4" />
          </motion.div>
          <p className="text-lg md:text-xl text-foreground/90 leading-relaxed mb-8">
            “NSYNC gave me one place for every trade, my playbook, and daily notes. The dashboard and
            comparison tools made it obvious what was working — it’s the journal I should have started with.”
          </p>
          <p className="font-semibold">Serious trader</p>
          <p className="text-sm text-muted-foreground">NSYNC Journal user</p>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Ready to transform your trading?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Join traders who track every session, follow their playbook, and climb the ranks. Free to start.
          </p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
            <Link to="/auth">
              <Button size="lg" className="rounded-full px-10 h-12 text-base font-semibold">
                Get started free
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 mb-10">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="NSYNC" className="w-8 h-8 rounded-lg" loading="lazy" />
              <span className="font-semibold">NSYNC Journal</span>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm text-muted-foreground">
              <a href="#overview" className="hover:text-foreground transition-colors">
                Overview
              </a>
              <a href="#features" className="hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#integrations" className="hover:text-foreground transition-colors">
                Integrations
              </a>
              <Link to="/auth" className="hover:text-foreground transition-colors">
                Sign in
              </Link>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} NSYNC Journal. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
