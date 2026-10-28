export type TicketStatus = 'Open' | 'Pending' | 'Closed';

export type TicketFilterType = 'total_tickets' | TicketStatus;

export interface TicketType {
  Id: number;
  ticketTitle: string;
  ticketDescription: string;
  Status: TicketStatus;
  thumb: string;
  AgentName: string;
  Date: Date;
  deleted: boolean;
}
