

import { BriefcaseBusiness, ArrowDownUp, Ellipsis } from "lucide-react";
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { DashboardCard } from "../../shared/dashboard-card";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import SimpleBar from "simplebar-react";
import { Button } from "@/components/ui/button";
import avatar1 from "@/assets/images/profile/user-1.png"
import avatar2 from "@/assets/images/profile/user-2.png"
import avatar3 from "@/assets/images/profile/user-3.png"
import avatar4 from "@/assets/images/profile/user-4.png"
import avatar9 from "@/assets/images/profile/user-9.png"
import avatar7 from "@/assets/images/profile/user-7.png"
import avatar6 from "@/assets/images/profile/user-6.png"

type StatusKey = "Processing" | "Delayed" | "Delivered" | "Cancelled";

// V1/S1: the template's literal hex status chips became cem tokens (S4
// mapping; the source hexes are listed in the improvement log, not here —
// the gate reads comments too): orange -> chart-5, red -> destructive,
// teal green -> success.
const statusConfig: Record<StatusKey, { bg: string; text: string }> = {
  Processing: { bg: "bg-chart-5/10", text: "text-chart-5" },
  Delayed: { bg: "bg-destructive/10", text: "text-destructive" },
  Delivered: { bg: "bg-success/10", text: "text-success" },
  Cancelled: { bg: "bg-destructive/10", text: "text-destructive" },
};

const orders: {
  id: string;
  project: string;
  avatar: string;
  name: string;
  role: string;
  status: StatusKey;
  price: string;
  deadline: string;
}[] = [
    {
      id: "SD-2026-001",
      project: "Modernize",
      avatar: avatar2,
      name: "Emily Carter",
      role: "Project Manager",
      status: "Processing",
      price: "$2,499.00",
      deadline: "Jun 14, 2026",
    },
    {
      id: "SD-2026-002",
      project: "Spike Admin",
      avatar: avatar3,
      name: "Jason Miller",
      role: "Web Developer",
      status: "Delayed",
      price: "$1,348.00",
      deadline: "May 10, 2026",
    },
    {
      id: "SD-2026-003",
      project: "Material Pro",
      avatar: avatar7,
      name: "Ryan Scott",
      role: "UI/UX Designer",
      status: "Delivered",
      price: "$1,198.00",
      deadline: "Jul 2, 2026",
    },
    {
      id: "SD-2026-004",
      project: "Xtreme Admin",
      avatar: avatar6,
      name: "Olivia Williams",
      role: "Frontend Developer",
      status: "Delivered",
      price: "$799.00",
      deadline: "May 30, 2026",
    },
    {
      id: "SD-2026-005",
      project: "Nova Suite",
      avatar: avatar4,
      name: "Lisa Park",
      role: "Frontend Developer",
      status: "Cancelled",
      price: "$599.00",
      deadline: "Jul 15, 2026",
    },
    {
      id: "SD-2026-006",
      project: "Pulse CRM",
      avatar: avatar9,
      name: "David Kim",
      role: "Backend Developer",
      status: "Processing",
      price: "$5,498.00",
      deadline: "Jun 5, 2026",
    },
    {
      id: "SD-2026-007",
      project: "Vertex UI",
      avatar: avatar1,
      name: "Anna Martinez",
      role: "UI/UX Designer",
      status: "Delivered",
      price: "$1,199.00",
      deadline: "Jun 18, 2026",
    },
  ];

export default function ProjectsOrders() {
  return (
    <DashboardCard className="flex flex-col gap-0!">
      {/* Header */}
      <CardHeader className="border-b border-cem-hover">
        <CardTitle className="flex items-center gap-2">
          <BriefcaseBusiness size={16} className="text-cem-text" />
          <span>
            Projects & Orders
          </span>
        </CardTitle>
      </CardHeader>

      {/* Table */}
      <CardContent className="px-0!">
        <SimpleBar>
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-cem-hover">
                    <TableHead className="pl-4! px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated w-[160px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Project
                        <ArrowDownUp size={14} className="text-cem-secondary-elevated shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Item
                        <ArrowDownUp size={14} className="text-cem-secondary-elevated shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated w-[130px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Status
                        <ArrowDownUp size={14} className="text-cem-secondary-elevated shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated w-[120px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Price
                        <ArrowDownUp size={14} className="text-cem-secondary-elevated shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated w-[130px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Deadline
                        <ArrowDownUp size={14} className="text-cem-secondary-elevated shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="pr-4! px-2 py-3 h-auto w-[48px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {orders.map((order) => {
                    const { bg, text } = statusConfig[order.status];
                    return (
                      <TableRow
                        key={order.id}
                        className="border-cem-hover hover:bg-cem-hover/30"
                      >
                        {/* Project */}
                        <TableCell className="pl-4! px-4 py-3 w-[160px]">
                          <div className="flex flex-col leading-5">
                            <span className="text-sm font-medium text-cem-text whitespace-nowrap">
                              {order.id}
                            </span>
                            <span className="text-sm font-normal text-cem-secondary-elevated whitespace-nowrap">
                              {order.project}
                            </span>
                          </div>
                        </TableCell>

                        {/* Item */}
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={order.avatar}
                              alt={order.name}
                              width={30}
                              height={30}
                              className="rounded-full object-cover shrink-0"
                            />
                            <div className="flex flex-col leading-5">
                              <span className="text-sm font-medium text-cem-text whitespace-nowrap">
                                {order.name}
                              </span>
                              <span className="text-sm font-normal text-cem-secondary-elevated whitespace-nowrap">
                                {order.role}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="px-4 py-3 w-[130px]">
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-normal whitespace-nowrap ${bg} ${text}`}
                          >
                            {order.status}
                          </span>
                        </TableCell>

                        {/* Price */}
                        <TableCell className="px-4 py-3 w-[120px]">
                          <span className="text-sm font-normal text-cem-secondary-elevated whitespace-nowrap">
                            {order.price}
                          </span>
                        </TableCell>

                        {/* Deadline */}
                        <TableCell className="px-4 py-3 w-[130px]">
                          <span className="text-sm font-normal text-cem-secondary-elevated whitespace-nowrap">
                            {order.deadline}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="pr-4! px-2 py-3 w-[48px]">
                          <Button
                            variant="ghost"
                            className="p-2 rounded-lg hover:bg-cem-hover/50 transition-colors cursor-pointer"
                            aria-label="More options"
                          >
                            <Ellipsis size={16} className="text-cem-text" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </SimpleBar>
      </CardContent>
    </DashboardCard>
  );
}
