import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Join TripGenie for free. Create an account to save your AI-generated travel itineraries and access them from anywhere.',
  robots: {
    index: true,
    follow: true,
  },
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
