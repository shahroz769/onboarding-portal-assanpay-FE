// recharts only ships in this lazy chunk. Keep every reference to
// dashboard-charts dynamic so it never lands in the entry bundle.
export const loadDashboardCharts = () => import('./dashboard-charts')
