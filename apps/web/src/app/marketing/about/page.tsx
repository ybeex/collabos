import { AboutPage } from '@/components/marketing/about-page'

export const metadata = {
  title: 'About — CollabOS',
  description: 'Why we built CollabOS, and where we are headed.',
  robots: { index: true, follow: true },
}

export default function About() {
  return <AboutPage />
}
