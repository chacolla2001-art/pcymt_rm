import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

/** Chart.js registration — attach to dashboard/stats routes only. */
export const CHART_ROUTE_PROVIDERS = provideCharts(withDefaultRegisterables());
