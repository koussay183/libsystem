import { lazy, useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetupNeeded } from '@/features/setup/SetupNeeded'
import { Flex, Spinner } from '@chakra-ui/react'
import { isFirebaseConfigured } from '@/lib/firebase'

// Code-split the feature pages so the initial load stays small (the dashboard
// pulls in the charting library, which we don't want in the first bundle).
//
// The three the owner actually opens every day keep a named loader so they can
// also be fetched ahead of time — see the prefetch below.
const loadHome = () => import('@/features/home/HomePage')
const loadCaisse = () => import('@/features/pos/CaissePage')
const loadStock = () => import('@/features/stock/StockPage')

const HomePage = lazy(() => loadHome().then((m) => ({ default: m.HomePage })))
const CaissePage = lazy(() => loadCaisse().then((m) => ({ default: m.CaissePage })))
const StockPage = lazy(() => loadStock().then((m) => ({ default: m.StockPage })))
const InvoicesPage = lazy(() =>
  import('@/features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })),
)
const CreditPage = lazy(() =>
  import('@/features/credit/CreditPage').then((m) => ({ default: m.CreditPage })),
)
const CustomerDetailPage = lazy(() =>
  import('@/features/credit/CustomerDetailPage').then((m) => ({
    default: m.CustomerDetailPage,
  })),
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const SuppliersPage = lazy(() =>
  import('@/features/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const BackupPage = lazy(() =>
  import('@/features/backup/BackupPage').then((m) => ({ default: m.BackupPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function PageFallback() {
  return (
    <Flex justify="center" py={20}>
      <Spinner size="xl" colorPalette="brand" />
    </Flex>
  )
}

export function App() {
  /**
   * Warm the till in the background as soon as the browser is idle. Opening the
   * caisse is the first thing that happens every morning, and waiting for its
   * chunk to download with a customer already at the counter is exactly the
   * pause the shop feels. Fetched at idle so it never competes with the first
   * paint, and errors are ignored — this is only ever an optimisation.
   */
  useEffect(() => {
    if (!isFirebaseConfigured) return
    const warm = () => {
      void loadCaisse().catch(() => {})
      void loadHome().catch(() => {})
      void loadStock().catch(() => {})
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 3000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(warm, 1500)
    return () => window.clearTimeout(id)
  }, [])

  // Before the owner pastes their Firebase config, show a setup screen
  // instead of a blank crash.
  if (!isFirebaseConfigured) return <SetupNeeded />

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route
              path="/"
              element={
                <Suspense fallback={<PageFallback />}>
                  <HomePage />
                </Suspense>
              }
            />
            <Route
              path="/caisse"
              element={
                <Suspense fallback={<PageFallback />}>
                  <CaissePage />
                </Suspense>
              }
            />
            <Route
              path="/stock"
              element={
                <Suspense fallback={<PageFallback />}>
                  <StockPage />
                </Suspense>
              }
            />
            <Route
              path="/invoices"
              element={
                <Suspense fallback={<PageFallback />}>
                  <InvoicesPage />
                </Suspense>
              }
            />
            <Route
              path="/suppliers"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SuppliersPage />
                </Suspense>
              }
            />
            <Route
              path="/credit"
              element={
                <Suspense fallback={<PageFallback />}>
                  <CreditPage />
                </Suspense>
              }
            />
            <Route
              path="/credit/:id"
              element={
                <Suspense fallback={<PageFallback />}>
                  <CustomerDetailPage />
                </Suspense>
              }
            />
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<PageFallback />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path="/reports"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ReportsPage />
                </Suspense>
              }
            />
            <Route
              path="/backup"
              element={
                <Suspense fallback={<PageFallback />}>
                  <BackupPage />
                </Suspense>
              }
            />
            <Route
              path="/settings"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SettingsPage />
                </Suspense>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
