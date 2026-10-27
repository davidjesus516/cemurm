import { cn } from "@/lib/utils";
import type * as React from "react";
import { Card } from "@/components/ui/card";

export function DashboardCard({
    className,
    ...props
}: React.ComponentProps<typeof Card>) {
    return (
        <Card
            className={cn("shadow-none h-full", className)}
            {...props}
        />
    );
}