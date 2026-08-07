import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom"

import { RouteLoading } from "@/components/route-loading"
import { TeacherShell } from "@/components/layout/TeacherShell"
import { StudentShell } from "@/components/layout/StudentShell"
import { ClassWorkspaceLayout } from "@/components/layout/ClassWorkspaceLayout"
import { RequireAuth } from "@/routes/teacher/RequireAuth"
import { RequireDevice } from "@/routes/student/RequireDevice"

// Route-based code splitting: teacher and student bundles never load
// into the same session, since a device is (almost) always exclusively one.
const LandingPage = lazy(() => import("@/routes/LandingPage"))
const JoinPage = lazy(() => import("@/routes/JoinPage"))
const NotFoundPage = lazy(() => import("@/routes/NotFoundPage"))

const TeacherLoginPage = lazy(() => import("@/routes/teacher/LoginPage"))
const TeacherDashboardPage = lazy(() => import("@/routes/teacher/DashboardPage"))
const TeacherClassesPage = lazy(() => import("@/routes/teacher/ClassesPage"))

const ClassHivePage = lazy(() => import("@/routes/teacher/class/ClassHivePage"))
const ClassStudentsPage = lazy(() => import("@/routes/teacher/class/ClassStudentsPage"))
const ClassGamesPage = lazy(() => import("@/routes/teacher/class/ClassGamesPage"))
const ClassStatisticsPage = lazy(() => import("@/routes/teacher/class/ClassStatisticsPage"))

const StudentDashboardPage = lazy(() => import("@/routes/student/DashboardPage"))
const StudentHivePage = lazy(() => import("@/routes/student/HivePage"))
const StudentGamePage = lazy(() => import("@/routes/student/GamePage"))

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>
}

const router = createBrowserRouter([
  { path: "/", element: withSuspense(<LandingPage />) },
  { path: "/join", element: withSuspense(<JoinPage />) },
  { path: "/t/login", element: withSuspense(<TeacherLoginPage />) },
  {
    path: "/t",
    element: <RequireAuth />,
    children: [
      {
        element: <TeacherShell />,
        children: [
          { index: true, element: withSuspense(<TeacherDashboardPage />) },
          { path: "classes", element: withSuspense(<TeacherClassesPage />) },
          {
            path: "classes/:classId",
            element: <ClassWorkspaceLayout />,
            children: [
              { index: true, element: <Navigate to="students" replace /> },
              { path: "hive", element: withSuspense(<ClassHivePage />) },
              { path: "students", element: withSuspense(<ClassStudentsPage />) },
              { path: "games", element: withSuspense(<ClassGamesPage />) },
              { path: "statistics", element: withSuspense(<ClassStatisticsPage />) },
            ],
          },
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
          { path: "hive", element: withSuspense(<StudentHivePage />) },
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
