import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND, BUSINESS, BUSINESS_ADDRESS } from "@/lib/brand";

export const metadata = { title: "Refund and Cancellation Policy", description: `Refunds, cancellation and credits at ${BRAND.name}.` };

export default function RefundsPage() {
  const email = <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>;
  return (
    <LegalPage
      title="Refund and Cancellation Policy"
      updated="September 30, 2026"
      intro={<p>Every new account gets free credits, so you can see what {BRAND.name} makes before you pay. Because credits are delivered and usable the moment you buy them, credit pack purchases are final.</p>}
      sections={[
        {
          heading: "Credit packs",
          body: <p>Credit packs are one-time purchases and are non-refundable, except where the law requires otherwise. Credits never expire, so you can use them whenever you need a video.</p>,
        },
        {
          heading: "Cancellation",
          body: (
            <p>
              There are no subscriptions, so there&apos;s nothing to cancel and you&apos;re never charged again automatically. Each purchase is a single payment for one credit pack. You can stop using {BRAND.name} at any
              time, and ask us to close your account by emailing {email}.
            </p>
          ),
        },
        {
          heading: "Failed videos",
          body: <p>If a video fails to render, its credits are returned to your account automatically. You don&apos;t need to ask.</p>,
        },
        {
          heading: "Not happy with a video?",
          body: <p>Ask for a change in plain English on the video&apos;s page. A revision costs half the credits of a new video (rounded up). If something looks broken, email {email} and we&apos;ll take a look.</p>,
        },
        {
          heading: "Billing mistakes",
          body: (
            <p>
              If you were charged twice, charged the wrong amount, or paid but didn&apos;t receive your credits, email {email} within 30 days of the charge. We&apos;ll add the missing credits or refund the mistaken
              charge.
            </p>
          ),
        },
        {
          heading: "How refunds are paid",
          body: (
            <p>
              Payments are handled by Dodo Payments, our Merchant of Record. Any refund we approve goes back to your original payment method through Dodo Payments, usually within 5 to 10 business days depending on your
              bank. See also our <Link href="/terms">Terms of Service</Link>.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>
              Refund questions: {email}, or by post to {BUSINESS.owner}, {BUSINESS_ADDRESS}.
            </p>
          ),
        },
      ]}
    />
  );
}
