import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND, BUSINESS, BUSINESS_ADDRESS } from "@/lib/brand";

export const metadata = { title: "Terms of Service", description: `The terms for using ${BRAND.name}.` };

export default function TermsPage() {
  const email = <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>;
  return (
    <LegalPage
      title="Terms of Service"
      updated="September 30, 2026"
      intro={
        <p>
          These terms are an agreement between you and {BUSINESS.owner}, who runs {BRAND.name} at {BRAND.domain} (&ldquo;{BRAND.name}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) from {BUSINESS_ADDRESS}. By creating an
          account or making a video, you agree to them. If you don&apos;t agree, please don&apos;t use {BRAND.name}.
        </p>
      }
      sections={[
        {
          heading: "What Hyped does",
          body: (
            <p>
              {BRAND.name} turns your website or GitHub repository into a short launch or demo video with motion graphics, music, optional AI voiceover and captions, and share copy. Videos are generated automatically by
              AI. The service is in beta, so features may change.
            </p>
          ),
        },
        {
          heading: "Your account",
          body: (
            <>
              <p>You must be at least 18 years old and able to enter into a contract to use {BRAND.name}. Keep your sign-in secure; you&apos;re responsible for what happens in your account.</p>
            </>
          ),
        },
        {
          heading: "What you submit",
          body: (
            <>
              <p>
                You may only submit websites, repositories and material that you own or are authorized to promote. You keep all rights in what you submit. You give us permission to access, copy and process it only to
                make, store and deliver your videos.
              </p>
              <p>If you give us a GitHub token for a private repository, it&apos;s encrypted in your browser and used only to download that repository. You can remove it at any time.</p>
            </>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <>
              <p>You agree not to use {BRAND.name} to make videos that:</p>
              <ul>
                <li>impersonate a real person, brand or organization, or suggest an endorsement that doesn&apos;t exist;</li>
                <li>use someone else&apos;s product, content or trademarks without permission;</li>
                <li>make false or misleading claims, or promote anything illegal;</li>
                <li>contain sexual, hateful, violent or harassing content, or target children;</li>
                <li>promote gambling, crypto schemes, weapons, drugs or other restricted goods and services.</li>
              </ul>
              <p>Don&apos;t try to break, overload or get around the limits of the service. We may refuse, remove or stop any job or account that breaks these rules.</p>
            </>
          ),
        },
        {
          heading: "Your videos",
          body: (
            <>
              <p>
                Subject to these terms and to the licenses below, you own the videos, posters and share copy we deliver to you, and you may use them commercially, including in ads. Similar output may be generated for
                other customers.
              </p>
              <ul>
                <li>Library music is licensed under CC BY 4.0 from Sascha Ende (ende.app). Credit is appreciated but not required.</li>
                <li>Library sound effects are CC0 (public domain).</li>
                <li>Voiceovers are AI-generated. Where you publish a video with a voiceover, let your audience know the voice is AI-generated (for example, &ldquo;AI voiceover&rdquo; in the post).</li>
              </ul>
              <p>AI can make mistakes. Review each video before you publish it; you&apos;re responsible for what you publish.</p>
            </>
          ),
        },
        {
          heading: "Credits and payment",
          body: (
            <>
              <p>
                Videos are paid for with credits. New accounts get free credits to try {BRAND.name}. You can buy more in one-time packs at the prices shown on our <Link href="/#pricing">pricing</Link>; there are no
                subscriptions. Prices include tax, and in India they&apos;re in rupees with GST included. Credits never expire, have no cash value and can&apos;t be transferred. If a render fails, its credits are
                returned automatically.
              </p>
              <p>
                Our order process is run by our online reseller, Dodo Payments, which is the Merchant of Record for all orders. Dodo Payments handles checkout, payment, invoices and sales tax or VAT, and its terms apply
                to your purchase.
              </p>
              <p>
                <strong>Delivery:</strong> nothing is shipped. Credits appear in your account within seconds of payment, and each video is delivered to your dashboard when it&apos;s ready, usually in 10 to 20 minutes (up
                to an hour for a 90-second video). You can download it from there.
              </p>
            </>
          ),
        },
        {
          heading: "Refunds",
          body: (
            <p>
              See our <Link href="/refunds">Refund and Cancellation Policy</Link>.
            </p>
          ),
        },
        {
          heading: "Availability and changes",
          body: (
            <p>
              We work to keep {BRAND.name} running, but we don&apos;t guarantee it will always be available or error-free. We may change, pause or discontinue features. If we discontinue the service, we&apos;ll give you
              reasonable notice to use your remaining credits.
            </p>
          ),
        },
        {
          heading: "Ending your use",
          body: (
            <p>
              You can stop using {BRAND.name} at any time and ask us to delete your account. We may suspend or close accounts that break these terms. Credits are not refunded when an account is closed for breaking them.
            </p>
          ),
        },
        {
          heading: "Disclaimers and liability",
          body: (
            <>
              <p>
                {BRAND.name} is provided &ldquo;as is&rdquo;. To the extent the law allows, we disclaim all implied warranties, and we&apos;re not liable for indirect or consequential losses, lost profits or lost data.
                Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.
              </p>
              <p>Nothing in these terms limits any rights you have under the consumer protection laws of your country that can&apos;t be excluded.</p>
            </>
          ),
        },
        {
          heading: "Changes to these terms",
          body: <p>We may update these terms. If a change is significant, we&apos;ll tell you by email or in the app before it takes effect. Continuing to use {BRAND.name} after that means you accept the new terms.</p>,
        },
        {
          heading: "Contact",
          body: (
            <p>
              Questions about these terms: {email}, or by post to {BUSINESS.owner}, {BUSINESS_ADDRESS}. See also our <Link href="/contact">Contact page</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
