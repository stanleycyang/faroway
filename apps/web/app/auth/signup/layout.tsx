import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Join Faroway for free. Create an account to save your AI-generated travel itineraries and access them from anywhere.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
