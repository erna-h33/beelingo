import { LayoutDashboard } from "lucide-react"

import { PlaceholderPage } from "@/components/placeholder-page"

export default function DashboardPage() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Teacher Dashboard"
      description="Vocabulary collected, top contributors, most missed words, recent games, and average accuracy."
      milestone="M10"
    />
  )
}
