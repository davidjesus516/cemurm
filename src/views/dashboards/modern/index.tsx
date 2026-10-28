import { useState } from 'react';
import { CalendarDays, ListMusic, Music, Users } from 'lucide-react';
import AdvertisementCost from "@/components/dashboards/modern/advertisement-cost";
import OverviewTab from "@/components/dashboards/modern/overview-tab";
import TotalOrders from "@/components/dashboards/modern/total-orders";
import TotalProfit from "@/components/dashboards/modern/total-profit";
import TotalSales from "@/components/dashboards/modern/total-sales";
import UpdateBanner from "@/components/dashboards/modern/update-banner"
import TotalAssets, { type AssetItem } from "@/components/dashboards/modern/totals-assets";
import ProjectsOrders from "src/components/dashboards/modern/projects-orders";
import {
  useAdminOverview,
  type Period,
} from "@/hooks/shared/useAdminOverview";

const ModernDashboard = () => {
  const overview = useAdminOverview();
  const [period, setPeriod] = useState<Period>('Last 30 Days');

  const assets: AssetItem[] = [
    { id: 'songs', title: 'Songs', href: '/songs', value: overview.counts.songs, icon: Music },
    { id: 'setlists', title: 'Setlists', href: '/setlists', value: overview.counts.setlists, icon: ListMusic },
    { id: 'events', title: 'Events', href: '/gigs', value: overview.counts.gigs, icon: CalendarDays },
    { id: 'bandmates', title: 'Bandmates', href: '/bandmates', value: overview.counts.bandmates, icon: Users },
  ];

  return (
    <>
      <div className="pb-4">
        <OverviewTab
          name={overview.name}
          period={period}
          onPeriodChange={setPeriod}
          onRefresh={overview.refresh}
          onExport={overview.exportCsv}
          loading={overview.loading}
        />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <UpdateBanner
            upcomingCount={overview.upcoming.length}
            nextEvent={overview.upcoming[0] ?? null}
          />
        </div>
        <div className="lg:col-span-7 col-span-12">
          <TotalSales
            chartData={overview.chart[period]}
            stats={overview.stats[period]}
          />
        </div>
        <div className="lg:col-span-5 col-span-12">
          <TotalAssets assets={assets} />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <TotalOrders
            value={overview.counts.rehearsals}
            badge={`${overview.upcomingRehearsals} upcoming`}
          />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <TotalProfit value={overview.counts.bandmates} badge="active" />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <AdvertisementCost value={overview.counts.organizations} badge="active" />
        </div>
        <div className="col-span-12">
          <ProjectsOrders events={overview.events} />
        </div>
      </div>
    </>
  );
};

export default ModernDashboard;
