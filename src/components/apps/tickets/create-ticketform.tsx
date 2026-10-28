import { useState, useContext, useEffect } from "react";
import { TicketContext } from "@/context/ticket-context/index";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { isValid, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import type { TicketType } from "src/types/apps/ticket";
import { demoAgents } from "@/demo/content";

const CreateTicketForm = () => {
  const { tickets, addTicket } = useContext(TicketContext);
  const [ticketId, setTicketId] = useState<number | undefined>(undefined);
  const [ticketDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(demoAgents[0]);

  const router = useNavigate();

  useEffect(() => {
    // Find the maximum ID in the existing tickets
    const maxId = tickets.reduce(
      (max, ticket) => (ticket.Id > max ? ticket.Id : max),
      0
    );
    // Set the new ticket ID
    setTicketId(maxId + 1);
  }, [tickets]);

  const canSave =
    ticketTitle.trim().length > 0 && ticketDescription.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) return;

    const newTicket: TicketType = {
      Id: ticketId ?? 0,
      ticketTitle: ticketTitle.trim(),
      ticketDescription: ticketDescription.trim(),
      Status: "Open",
      thumb: selectedAgent.photo,
      AgentName: selectedAgent.name,
      Date: new Date(ticketDate),
      deleted: false,
    };

    addTicket(newTicket);
    resetForm();
    router("/dashboard/apps/tickets");
  };

  const resetForm = () => {
    setTicketId(undefined);
    setTicketTitle("");
    setTicketDescription("");
    setSelectedAgent(demoAgents[0]);
  };

  const parsedDate = isValid(new Date(ticketDate))
    ? new Date(ticketDate)
    : new Date();
  const formattedOrderDate = format(parsedDate, "EEEE, MMMM dd, yyyy");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold">Create ticket</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cem-secondary-elevated">
          <span>Ticket #{ticketId ?? "—"}</span>
          <span aria-hidden>·</span>
          <span>{formattedOrderDate}</span>
        </div>
        <div className="my-6 rounded-xl border border-cem-hover bg-cem-base p-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="ticketTitle" className="mb-2 block">
                Ticket title
              </Label>
              <Input
                id="ticketTitle"
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                placeholder="Short summary"
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="ticketDescription" className="mb-2 block">
                Ticket description
              </Label>
              <Textarea
                id="ticketDescription"
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="What needs to happen?"
                className="min-h-[120px] w-full"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Label className="mb-2 block">Assigned to</Label>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={selectedAgent.photo}
                      alt={selectedAgent.name}
                    />
                    <AvatarFallback>
                      {selectedAgent.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {selectedAgent.name}
                  <ChevronDown className="ml-1 h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="rounded-md">
                  {demoAgents.map((agent) => (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={agent.photo}
                            alt={agent.name}
                            width={40}
                            height={40}
                          />
                          <AvatarFallback>{agent.name[0]}</AvatarFallback>
                        </Avatar>
                        <span>{agent.name}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router("/dashboard/apps/tickets")}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreateTicketForm;
