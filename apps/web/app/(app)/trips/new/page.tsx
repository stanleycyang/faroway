import { permanentRedirect } from "next/navigation";

export const metadata = {
  title: "Create New Trip",
  description: "Plan your next adventure with AI-powered itineraries",
};

export default function NewTripPage() {
  permanentRedirect("/create");
}
