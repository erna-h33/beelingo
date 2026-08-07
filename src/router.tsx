import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import { RouteLoading } from "@/components/route-loading"
import { TeacherShell } from "@/components/layout/TeacherShell"
import { StudentShell } from "@/components/layout/StudentShell"
import { RequireAuth } from "@/routes/teacher/RequireAuth"
import { RequireDevice } from "@/routes/student/RequireDevice"

// Route-based code splitting: teacher and student bundles never load
// into the same session, since a device is (almost) always exclusively one.
const LandingPage = lazy(() => import("@/routes/LandingPage"))
const JoinPage = lazy(() => import("@/routes/JoinPage"))
const NotFoundPage = lazy(() => import("@/routes/NotFoundPage"))

const TeacherDashboardPage = lazy(() => import("@/routes/teacher/DashboardPage"))
const TeacherCoursesPage = lazy(() => import("@/routes/teacher/CoursesPage"))

const StudentDashboardPage = lazy(() => import("@/routes/student/DashboardPage"))
const StudentVocabularyPage = lazy(() => import("@/routes/student/VocabularyPage"))
const StudentGamePage = lazy(() => import("@/routes/student/GamePage"))

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>
}

const router = createBrowserRouter([
  { path: "/", element: withSuspense(<LandingPage />) },
  { path: "/join", element: withSuspense(<JoinPage />) },
  {
    path: "/t",
    element: <RequireAuth />,
    children: [
      {
        element: <TeacherShell />,
        children: [
          { index: true, element: withSuspense(<TeacherDashboardPage />) },
          { path: "courses", element: withSuspense(<TeacherCoursesPage />) },
        ],
      },
    ],
  },
  {
    path: "/s",
    element: <RequireDevice />,
    children: [
      {
        element: <StudentShell />,
        children: [
          { index: true, element: withSuspense(<StudentDashboardPage />) },
          { path: "vocabulary", element: withSuspense(<StudentVocabularyPage />) },
          { path: "game", element: withSuspense(<StudentGamePage />) },
        ],
      },
    ],
  },
  { path: "*", element: withSuspense(<NotFoundPage />) },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
