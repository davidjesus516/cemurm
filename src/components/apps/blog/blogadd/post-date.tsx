

import { Label } from "@/components/ui/label";
import { useState } from "react";

// ShadCN UI Date Picker components
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PostDate = () => {
  // Set today's date as default

  const [publishDate, setPublishDate] = useState<Date | undefined>(new Date());

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <h5>Publish Date</h5>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div>
          <div className="mb-2">
            <Label htmlFor="publishDate">
              Select publish date
              <span className="text-destructive">*</span>
            </Label>
          </div>
          <div>
            <Popover>
              <PopoverTrigger
                className={"w-full"}
                render={
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !publishDate && "text-cem-secondary-elevated"
                    )}
                  />
                }
              >
                <CalendarIcon />
                {publishDate ? (
                  format(publishDate, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start">
                <Calendar
                  mode="single"
                  selected={publishDate}
                  onSelect={setPublishDate}

                />
              </PopoverContent>
            </Popover>
          </div>
          <small className="text-xs text-cem-secondary-elevated">
            Choose the date when this blog post should be published.
          </small>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostDate;
