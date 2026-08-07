import { Home } from "lucide-react"

import { PlaceholderPage } from "@/components/placeholder-page"

export default function DashboardPage() {
  return (
    <PlaceholderPage
      icon={Home}
      title="Your Dashboard"
      description="Jump into a game, and see your learning streak, accuracy, contributions, and words learned."
      milestone="M10"
    />
  )
}
