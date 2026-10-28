import { CardContent } from "@/components/ui/card";
import { DashboardCard } from "../../shared/dashboard-card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface TotalProfitProps {
  value: number;
  badge: string;
}

export default function TotalProfit({ value, badge }: TotalProfitProps) {
  return (
    <DashboardCard className="py-6">
      <CardContent className="flex justify-between flex-row px-6">
        <div className="flex flex-col items-start gap-4 w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-normal text-cem-text">
                Bandmates
              </p>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-semibold">{value.toLocaleString()}</h3>
                <Badge className="bg-chart-2/10! text-chart-2!">{badge}</Badge>
              </div>
            </div>
            <div className="border border-cem-hover p-2.5 w-fit rounded-md">
              <Users size={16} />
            </div>
          </div>
          <Link
            to="/bandmates"
            className={buttonVariants({
              variant: 'outline',
              className: 'gap-1.5 px-4 py-2 h-auto rounded-md',
            })}
          >
            View bandmates
            <span>
              <ArrowRight width={18} height={18} />
            </span>
          </Link>
        </div>
      </CardContent>
    </DashboardCard>
  );
}
