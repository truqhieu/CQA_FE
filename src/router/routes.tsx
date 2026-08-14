import { lazy, Suspense, type ReactNode } from "react";
import PageLoader from "@/components/PageLoader";

const DashboardPage = lazy(() => import("@/pages/Dashboard/DashboardPage"));
const ConversationsPage = lazy(() => import("@/pages/Conversations/ConversationsPage"));
const PancakeTestPage = lazy(() => import("@/pages/PancakeTest/PancakeTestPage"));
const AIInsightPage = lazy(() => import("@/pages/AIInsight/AIInsightPage"));
const QualityPage = lazy(() => import("@/pages/Quality/QualityPage"));
const EmployeesPage = lazy(() => import("@/pages/Employees/EmployeesPage"));
const CustomersPage = lazy(() => import("@/pages/Customers/CustomersPage"));
const PagesPage = lazy(() => import("@/pages/Pages/PagesPage"));
const AdsPage = lazy(() => import("@/pages/Ads/AdsPage"));
const ProductsPage = lazy(() => import("@/pages/Products/ProductsPage"));
const RevenuePage = lazy(() => import("@/pages/Revenue/RevenuePage"));
const ReportsPage = lazy(() => import("@/pages/Reports/ReportsPage"));
const WarrantyPage = lazy(() => import("@/pages/Warranty/WarrantyPage"));
const SettingsPage = lazy(() => import("@/pages/Settings/SettingsPage"));

function lazyPage(element: ReactNode, label?: string) {
  return <Suspense fallback={<PageLoader label={label} />}>{element}</Suspense>;
}

export const routes = [
  { path: "/", element: lazyPage(<DashboardPage />, "Đang tải tổng quan...") },
  { path: "/conversations", element: lazyPage(<ConversationsPage />) },
  { path: "/pancake-test", element: lazyPage(<PancakeTestPage />) },
  { path: "/ai-insight", element: lazyPage(<AIInsightPage />) },
  { path: "/quality", element: lazyPage(<QualityPage />) },
  { path: "/employees", element: lazyPage(<EmployeesPage />) },
  { path: "/customers", element: lazyPage(<CustomersPage />) },
  { path: "/pages", element: lazyPage(<PagesPage />) },
  { path: "/ads", element: lazyPage(<AdsPage />) },
  { path: "/products", element: lazyPage(<ProductsPage />) },
  { path: "/revenue", element: lazyPage(<RevenuePage />) },
  { path: "/reports", element: lazyPage(<ReportsPage />) },
  { path: "/warranty", element: lazyPage(<WarrantyPage />) },
  { path: "/settings", element: lazyPage(<SettingsPage />) },
];
