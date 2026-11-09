import { SecurityPage } from '@/components/marketing/security-page'

export const metadata = {
  title: 'Security — CollabOS',
  description: 'How we protect your team\'s data. Encryption, access controls, audit logs, and self-hosting.',
  robots: { index: true, follow: true },
}

export default function Security() {
  return <SecurityPage />
}
