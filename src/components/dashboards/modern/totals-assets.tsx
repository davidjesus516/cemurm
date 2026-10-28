'use client'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardCard } from "../../shared/dashboard-card";
import { Box } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface AssetItem {
  id: string;
  title: string;
  href: string;
  value: number;
  icon: React.ElementType;
}

function AssetCard({ title, href, value, icon: Icon }: AssetItem) {
  return (
    <Link
      to={href}
      className='flex flex-col justify-between p-6 bg-cem-surface transition-colors hover:bg-cem-hover/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cem-amber'
    >
      <div className='border border-cem-hover rounded-md p-2 w-fit'>
        <Icon width={16} height={16} />
      </div>
      <div>
        <h6 className='text-2xl font-semibold'>{value.toLocaleString()}</h6>
        <p className='text-sm font-normal'>{title}</p>
      </div>
    </Link>
  );
}

export default function TotalAssets({ assets }: { assets: AssetItem[] }) {
  return (
    <DashboardCard className="flex flex-col gap-0! pb-0!">
      <CardHeader className="border-b border-cem-hover">
        <CardTitle className="flex items-center gap-2">
          <Box size={16} className="text-cem-secondary-elevated" />
          Summary
        </CardTitle>
      </CardHeader>
      <CardContent className='h-full! px-0!'>
        <div className='h-full!'>
          <div className='grid grid-cols-2 h-full! gap-px bg-cem-hover'>
            {assets.map((item) => (
              <AssetCard key={item.id} {...item} />
            ))}
          </div>
        </div>
      </CardContent>
    </DashboardCard>
  );
}
