import { PricingPage } from '@/components/marketing/pricing-page'

export const metadata = {
  title: 'Pricing — CollabOS',
  description: 'Free for small teams. Pro from $12/seat. Enterprise with SSO, SCIM, and unlimited everything.',
  robots: { index: true, follow: true },
}

export default function Pricing() {
  return <PricingPage />
}
