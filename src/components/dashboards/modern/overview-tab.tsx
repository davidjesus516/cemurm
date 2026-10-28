'use client'
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, RefreshCcw, Download, Sun, Moon } from 'lucide-react';
import { PERIODS, type Period } from '@/hooks/shared/useAdminOverview';

interface OverviewTabProps {
  name: string;
  period: Period;
  onPeriodChange: (period: Period) => void;
  onRefresh: () => void;
  onExport: () => void;
  loading?: boolean;
}

export default function OverviewTab({
  name,
  period,
  onPeriodChange,
  onRefresh,
  onExport,
  loading = false,
}: OverviewTabProps) {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      setGreeting('Good Morning');
    } else if (hour >= 12 && hour < 17) {
      setGreeting('Good Afternoon');
    } else if (hour >= 17 && hour < 21) {
      setGreeting('Good Evening');
    } else {
      setGreeting('Good Night');
    }
  }, []);

  const getGreetingIcon = () => {
    if (greeting === 'Good Morning' || greeting === 'Good Afternoon') {
      return <Sun size={25} className="text-cem-amber" />;
    } else {
      return <Moon size={25} className="text-cem-secondary-elevated" />;
    }
  };

  return (
    <>
      <div className="flex items-center flex-wrap lg:flex-nowrap lg:gap-0 gap-4 justify-between">
        <div className='flex flex-col items-start'>
          <h2 className="text-xl flex items-center gap-2">
            {greeting}, {name} <span className="flex items-center">{getGreetingIcon()}</span>
          </h2>
          <p className='text-sm font-normal text-cem-secondary-elevated'>Your repertoire at a glance</p>
        </div>
        <div className="flex items-center lg:flex-nowrap flex-wrap gap-2">
          <Button
            variant="outline"
            className={"p-2.5 h-auto rounded-lg cursor-pointer"}
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh dashboard"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : undefined} />
          </Button>
          <div>
            <Select value={period} onValueChange={(value) => {
              if (PERIODS.includes(value as Period)) onPeriodChange(value as Period);
            }}>
              <SelectTrigger className="w-fit h-auto! text-cem-text cursor-pointer">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((item) => (
                  <SelectItem className={"cursor-pointer"} key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="flex items-center gap-1.5 h-auto px-4 py-2 rounded-lg cursor-pointer"
            onClick={onExport}
          >
            <Download size={16} />
            <span className="text-sm font-medium">Export</span>
          </Button>
        </div>
      </div>
    </>
  );
}
