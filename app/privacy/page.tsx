import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — Kharcha',
  description: 'Privacy Policy and data practices for Kharcha expense tracking application.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-[calc(env(safe-area-inset-top)+20px)]">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink2 hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Back to Settings
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
          <ShieldCheck size={22} />
        </span>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Privacy Policy</h1>
      </div>

      <div className="space-y-6 text-[15px] leading-relaxed text-ink2">
        <p>
          Last updated: November 2026. Kharcha (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is built with a privacy-first mindset.
          You can use Kharcha completely as a guest without creating an account or providing any personal details.
        </p>

        <section className="space-y-2">
          <h2 className="text-[18px] font-semibold text-ink">1. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Expense Data:</strong> The raw text or voice descriptions you submit, amounts, categories, payment modes, and timestamps.
            </li>
            <li>
              <strong>Guest Session:</strong> A pseudonymous random session identifier stored in an encrypted httpOnly cookie on your browser.
            </li>
            <li>
              <strong>Google Account Information (Optional):</strong> If you choose to link your Google account to back up your data, we only receive and store your basic Google profile details (unique Google identifier, verified email address, name, and profile picture). We do <em>not</em> store Google access tokens, nor do we request access to your private Google Drive, Gmail, or contacts.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[18px] font-semibold text-ink">2. How We Use Your Information</h2>
          <p>
            Your data is used solely to provide, calculate, categorize, and display your expense tracking insights. We do not sell, rent, or trade your personal data or expense history with any third parties or advertisers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[18px] font-semibold text-ink">3. AI Parsing & Security</h2>
          <p>
            When you enter an expense, the text is sent to our AI parsing service solely to extract financial details (amount, category, payment mode). Data is transmitted over secure SSL/TLS encryption.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[18px] font-semibold text-ink">4. Data Control & Deletion</h2>
          <p>
            You have full control over your data. You can edit or delete any logged entry at any time. When you log out, session tokens are permanently cleared from your browser.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[18px] font-semibold text-ink">5. Contact</h2>
          <p>
            If you have questions about this privacy policy, feel free to contact us through our official project repository.
          </p>
        </section>
      </div>
    </div>
  );
}

