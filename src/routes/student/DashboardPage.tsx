import { Home } from "lucide-react"

import { PlaceholderPage } from "@/components/placeholder-page"

export default function DashboardPage() {
  return (
    <PlaceholderPage
      icon={Home}
      title="Your Dashboard"
      description="Learning streak, games played, accuracy, contributions, and vocabulary learned."
      milestone="M10"
    />
  )
}
