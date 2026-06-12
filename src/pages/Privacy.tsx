import { Link } from "react-router-dom";

const LAST_UPDATED = "June 10, 2026";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <Link to="/" className="font-semibold">NSYNC Journal</Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          This Privacy Policy explains how NSYNC Journal ("we", "us", "our") collects, uses,
          stores, and protects your information when you use our trading journal application
          (the "Service"). By using the Service you agree to this policy.
        </p>

        <Section title="1. Information we collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-foreground">Account data</strong> — your email address and an
              encrypted password, managed by Supabase Auth.
            </li>
            <li>
              <strong className="text-foreground">Trading data</strong> — trades you log manually
              or that we import from connected brokers (instrument, direction, size, entry/exit
              prices, P&amp;L, timestamps, session, notes).
            </li>
            <li>
              <strong className="text-foreground">Broker credentials</strong> — when you connect a
              broker (e.g. MetaTrader 5, TradeLocker, MyFXBook), we store the credentials required
              to maintain that connection. Passwords are encrypted at rest using AES-GCM with a
              server-side secret before being stored.
            </li>
            <li>
              <strong className="text-foreground">Journal content</strong> — notebook entries,
              checklists, screenshots, and any other content you add to your journal.
            </li>
            <li>
              <strong className="text-foreground">Usage data</strong> — basic technical information
              such as browser type, device, and error logs, used to keep the Service running.
            </li>
          </ul>
        </Section>

        <Section title="2. How we use your information">
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide the core journal, analytics, and broker-sync features.</li>
            <li>To authenticate you and keep your session secure.</li>
            <li>To import, classify, and display your trade history.</li>
            <li>To diagnose bugs and improve reliability.</li>
            <li>To respond to support requests you send us.</li>
          </ul>
          <p>
            We do not sell your personal information. We do not use your trading data to train
            third-party AI models without your explicit opt-in.
          </p>
        </Section>

        <Section title="3. Where your data is stored">
          <p>
            Your data is stored in Supabase (Postgres), hosted on Supabase's infrastructure. Row
            Level Security (RLS) is enabled on every user-data table so that each user can only
            access their own rows. The site itself is hosted on Vercel.
          </p>
        </Section>

        <Section title="4. Third-party services">
          <p>We rely on the following sub-processors to operate the Service:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-foreground">Supabase</strong> — authentication, database, and edge functions.</li>
            <li><strong className="text-foreground">Vercel</strong> — application hosting.</li>
            <li><strong className="text-foreground">Broker APIs</strong> (TradeLocker, MyFXBook, MetaTrader 5) — only when you explicitly connect them, and only to fetch your own trading data.</li>
            <li><strong className="text-foreground">ForexFactory</strong> — public economic calendar feed (no personal data sent).</li>
          </ul>
          <p>
            We do not share your personal data with third parties for advertising or marketing.
          </p>
        </Section>

        <Section title="5. Cookies and local storage">
          <p>
            We use browser local storage to keep you signed in (Supabase session tokens) and to
            remember UI preferences (theme, layout). We do not use third-party advertising or
            analytics cookies.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We protect your data with industry-standard measures, including TLS in transit, RLS at
            the database level, and AES-GCM encryption for stored broker passwords. No system is
            perfectly secure; please use a strong, unique password and keep your broker credentials
            confidential.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>
            Depending on where you live (e.g. EU/UK under GDPR, California under CCPA), you may
            have the right to:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of that data.</li>
            <li>Export your data in a portable format.</li>
            <li>Withdraw consent or object to certain processing.</li>
            <li>Lodge a complaint with your local data-protection authority.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at the address in Section 10. You can also
            delete your account from inside the app at any time, which removes your stored journal
            data, broker connections, and credentials.
          </p>
        </Section>

        <Section title="8. Data retention">
          <p>
            We retain your data for as long as your account is active. If you delete your account,
            we delete your personal data within 30 days, except where we are legally required to
            keep it longer.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            The Service is not directed to anyone under 18. We do not knowingly collect personal
            data from children.
          </p>
        </Section>

        <Section title="10. Changes and contact">
          <p>
            We may update this policy from time to time. Material changes will be announced in the
            app or by email. Continued use of the Service after changes take effect constitutes
            acceptance of the updated policy.
          </p>
          <p>
            Questions or requests: <a className="text-primary hover:underline" href="mailto:justintk2021@gmail.com">justintk2021@gmail.com</a>.
          </p>
        </Section>

        <div className="pt-6 border-t border-border/60 text-xs text-muted-foreground">
          This document is a template and not legal advice. Have a qualified attorney review it
          before relying on it for production use.
        </div>
      </main>
    </div>
  );
};

export default Privacy;
