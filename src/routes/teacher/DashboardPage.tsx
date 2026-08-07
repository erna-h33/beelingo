import { LayoutDashboard } from "lucide-react"

import { PlaceholderPage } from "@/components/placeholder-page"

export default function DashboardPage() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Teacher Dashboard"
      description="Student counts, attendance, vocabulary collected, recent games, and average quiz score."
      milestone="M9"
    />
  )
}
