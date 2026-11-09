import { ChangelogPage } from '@/components/marketing/changelog-page'

export const metadata = {
  title: 'Changelog — CollabOS',
  description: 'Every improvement, bug fix, and new feature. Updated continuously.',
  robots: { index: true, follow: true },
}

export default function Changelog() {
  return <ChangelogPage />
}
