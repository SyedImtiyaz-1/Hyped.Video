import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND, BUSINESS, BUSINESS_ADDRESS } from "@/lib/brand";

export const metadata = { title: "Privacy Policy", description: `How ${BRAND.name} handles your data.` };

export default function PrivacyPage() {
  const email = <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>;
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 30, 2026"
      intro={
        <p>
          This policy explains what {BRAND.name} ({BRAND.domain}) collects, why, and the choices you have. We collect only what we need to make your videos, and we don&apos;t sell your personal data.
        </p>
      }
      sections={[
        {
          heading: "Who we are",
          body: (
            <p>
              {BRAND.name} is run by {BUSINESS.owner}, an individual business at {BUSINESS_ADDRESS}. {BUSINESS.owner} decides how your personal data is used and is responsible for it (the &ldquo;data fiduciary&rdquo;
              under India&apos;s Digital Personal Data Protection Act, 2023, and the &ldquo;controller&rdquo; under laws such as the GDPR). Contact: {email}.
            </p>
          ),
        },
        {
          heading: "What we collect",
          body: (
            <ul>
              <li>
                <strong>Account details:</strong> your name and email address, from sign-up or the sign-in provider you choose (such as Google).
              </li>
              <li>
                <strong>What you submit:</strong> the website or repository address, your brief and notes, and the choices you make for each video.
              </li>
              <li>
                <strong>What we make for you:</strong> your videos, posters, captions, share copy and video plans.
              </li>
              <li>
                <strong>Private repositories:</strong> if you add a GitHub token, it&apos;s encrypted in your browser before it reaches us. Only our render service can decrypt it, and only to download that repository.
              </li>
              <li>
                <strong>Payments:</strong> a record of what you bought and your credit balance. Card details go straight to Dodo Payments, and we never see or store them.
              </li>
              <li>
                <strong>Technical data:</strong> basic logs such as IP address, browser and error reports, used to run and secure the service.
              </li>
            </ul>
          ),
        },
        {
          heading: "How we use it",
          body: (
            <ul>
              <li>To make, store and deliver your videos, and to let you revise them.</li>
              <li>To run your account, credits and purchases, and to answer support requests.</li>
              <li>To keep the service secure and prevent abuse.</li>
              <li>To improve quality and cost, using aggregate measurements such as render times and success rates.</li>
            </ul>
          ),
        },
        {
          heading: "Who helps us run Hyped",
          body: (
            <>
              <p>We share data only with service providers that process it on our behalf, under contract:</p>
              <ul>
                <li>Cloudflare, for hosting, video rendering, speech processing and video storage;</li>
                <li>Neon, for our database;</li>
                <li>Clerk, for sign-in;</li>
                <li>Dodo Payments, our Merchant of Record, for checkout, payments, invoices and tax;</li>
                <li>AI service providers, which process your submitted content to write the storyboard and code, and to generate voiceovers.</li>
              </ul>
              <p>Some of these providers process data outside your country, including in the United States. We may also disclose data if the law requires it.</p>
            </>
          ),
        },
        {
          heading: "Cookies",
          body: <p>We use only the cookies needed to keep you signed in. We don&apos;t use advertising or tracking cookies.</p>,
        },
        {
          heading: "How long we keep it",
          body: (
            <p>
              We keep your account, videos and purchase records while your account is open. When you ask us to delete your account, we delete your account data and videos within 30 days, except for records we must keep
              by law, such as payment records. Technical logs are kept for a short time, usually no more than 30 days.
            </p>
          ),
        },
        {
          heading: "Your choices and rights",
          body: (
            <p>
              You can ask to see, correct, export or delete your personal data, or object to how we use it, by emailing {email}. We&apos;ll respond within 30 days. You can remove a saved GitHub token yourself at any
              time. Depending on where you live, you may also be able to complain to your local data protection authority.
            </p>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>Data is encrypted in transit. Each video is made in its own isolated, short-lived container that holds no passwords or payment details. No system is perfectly secure, but we work to protect your data.</p>
          ),
        },
        {
          heading: "Children",
          body: <p>{BRAND.name} is not for anyone under 18, and we don&apos;t knowingly collect their data.</p>,
        },
        {
          heading: "Grievance Officer",
          body: (
            <p>
              For any complaint about your personal data or this policy, contact our Grievance Officer, {BUSINESS.owner}, at {email} or by post at {BUSINESS_ADDRESS}. We acknowledge complaints within 48 hours and aim to
              resolve them within one month.
            </p>
          ),
        },
        {
          heading: "Changes and contact",
          body: <p>We&apos;ll post any changes to this policy here, and tell you about significant ones. Questions about privacy: {email}.</p>,
        },
      ]}
    />
  );
}
