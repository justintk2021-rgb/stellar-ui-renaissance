import { Link } from "react-router-dom";

const LAST_UPDATED = "June 10, 2026";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const Terms = () => {
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
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          These Terms of Service ("Terms") govern your use of NSYNC Journal (the "Service"). By
          creating an account or using the Service, you agree to these Terms. If you do not agree,
          do not use the Service.
        </p>

        <Section title="1. Eligibility">
          <p>
            You must be at least 18 years old and legally able to enter into a binding contract to
            use the Service.
          </p>
        </Section>

        <Section title="2. Your account">
          <p>
            You are responsible for safeguarding your account credentials and for any activity
            under your account. Notify us immediately at <a className="text-primary hover:underline" href="mailto:justintk2021@gmail.com">justintk2021@gmail.com</a> if
            you suspect unauthorized access.
          </p>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Use the Service for any unlawful purpose.</li>
            <li>Attempt to reverse-engineer, scrape, or interfere with the Service.</li>
            <li>Upload malicious content, share another user's data, or impersonate anyone.</li>
            <li>Use the Service to violate the terms of any connected broker or third-party API.</li>
          </ul>
        </Section>

        <Section title="4. Not financial advice">
          <p>
            NSYNC Journal is a record-keeping and analytics tool. Nothing in the Service
            constitutes financial, investment, tax, or legal advice. Trading financial instruments
            carries significant risk of loss. You are solely responsible for your trading
            decisions and outcomes.
          </p>
        </Section>

        <Section title="5. Broker connections">
          <p>
            When you connect a broker account, you authorize us to use the credentials and APIs
            you provide solely to import your trading data and (where supported) place trades you
            explicitly initiate. You remain solely responsible for any orders sent through the
            Service. We are not affiliated with any broker.
          </p>
        </Section>

        <Section title="6. Your content">
          <p>
            You retain ownership of the journal entries, notes, and other content you upload. You
            grant us a limited license to host, process, and display that content for the sole
            purpose of operating the Service for you.
          </p>
        </Section>

        <Section title="7. Service availability">
          <p>
            The Service is provided on an "as is" and "as available" basis. We do not guarantee
            uninterrupted access, error-free operation, or that imported broker data will always
            be complete or accurate.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            To the maximum extent permitted by law, NSYNC Journal and its operators shall not be
            liable for any indirect, incidental, consequential, or punitive damages, or for any
            trading losses, lost profits, or lost data arising out of or related to your use of
            the Service.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            You may delete your account at any time from inside the app. We may suspend or
            terminate access if you violate these Terms or use the Service in a way that creates
            risk for us or other users.
          </p>
        </Section>

        <Section title="10. Changes">
          <p>
            We may update these Terms from time to time. Material changes will be announced in the
            app or by email. Continued use after changes take effect constitutes acceptance.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about these Terms: <a className="text-primary hover:underline" href="mailto:justintk2021@gmail.com">justintk2021@gmail.com</a>.
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

export default Terms;
