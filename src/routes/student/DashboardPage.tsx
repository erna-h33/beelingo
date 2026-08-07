import { Home } from "lucide-react"

import { PlaceholderPage } from "@/components/placeholder-page"

export default function DashboardPage() {
  return (
    <PlaceholderPage
      icon={Home}
      title="Your Dashboard"
      description="Streak, lessons completed, quiz history, accuracy, vocabulary learned, and past games."
      milestone="M9"
    />
  )
}
