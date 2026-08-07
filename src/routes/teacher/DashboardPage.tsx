import { LayoutDashboard } from "lucide-react"

import { PlaceholderPage } from "@/components/placeholder-page"

export default function DashboardPage() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Teacher Dashboard"
      description="Total Hive words, new words this week, top contributors, most missed words, game history, and average accuracy."
      milestone="M10"
    />
  )
}
