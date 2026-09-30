import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND, BUSINESS, BUSINESS_ADDRESS } from "@/lib/brand";

export const metadata = { title: "Contact", description: `How to reach ${BRAND.name}, and who runs it.` };

export default function ContactPage() {
  const email = <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>;
  return (
    <LegalPage
      title="Contact"
      updated="September 30, 2026"
      intro={
        <p>
          {BRAND.name} is run by {BUSINESS.owner}, an individual business based in India. For help with your account, a video or a payment, email {email}.
        </p>
      }
      sections={[
        {
          heading: "Business details",
          body: (
            <ul>
              <li>
                <strong>Business name:</strong> {BRAND.name} ({BRAND.domain})
              </li>
              <li>
                <strong>Operated by:</strong> {BUSINESS.owner}
              </li>
              <li>
                <strong>Address:</strong> {BUSINESS_ADDRESS}
              </li>
              <li>
                <strong>Email:</strong> {email}
              </li>
            </ul>
          ),
        },
        {
          heading: "Support",
          body: (
            <p>
              Email {email} about anything to do with {BRAND.name}. For payment questions, include the email address you signed up with and, if you have it, your receipt from Dodo Payments.
            </p>
          ),
        },
        {
          heading: "Payments",
          body: (
            <p>
              Orders are processed by Dodo Payments, our Merchant of Record, which handles checkout, invoices and tax. See our <Link href="/refunds">Refund and Cancellation Policy</Link> for refunds.
            </p>
          ),
        },
        {
          heading: "Grievance Officer",
          body: (
            <p>
              For complaints, including about how we handle your personal data, contact our Grievance Officer, {BUSINESS.owner}, at {email} or by post at {BUSINESS_ADDRESS}. We acknowledge complaints within 48 hours and
              aim to resolve them within one month.
            </p>
          ),
        },
        {
          heading: "Policies",
          body: (
            <p>
              <Link href="/terms">Terms of Service</Link> · <Link href="/privacy">Privacy Policy</Link> · <Link href="/refunds">Refund and Cancellation Policy</Link>
            </p>
          ),
        },
      ]}
    />
  );
}
