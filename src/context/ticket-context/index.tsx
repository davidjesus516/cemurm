// Demo tickets store.
//
// The template's original context fetched /api/data/ticket/* from an MSW
// worker that is never started, so the page always rendered zero tickets.
// The demo keeps fixed content in React state instead: no network calls, no
// Supabase writes, and every change is lost on reload. The screen shows a
// demo notice that says exactly that.
import { createContext, useState } from 'react';
import React from 'react';
import { demoTickets } from '@/demo/content';
import type { TicketFilterType, TicketType } from '../../types/apps/ticket';

export interface TicketContextType {
  tickets: TicketType[];
  deleteTicket: (id: number) => void;
  setTicketSearch: (searchTerm: string) => void;
  ticketSearch: string;
  filter: TicketFilterType;
  setFilter: (filter: TicketFilterType) => void;
  addTicket: (ticket: TicketType) => void;
}

export const TicketContext = createContext<TicketContextType>(
  {} as TicketContextType,
);

export const TicketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tickets, setTickets] = useState<TicketType[]>(demoTickets);
  const [ticketSearch, setTicketSearch] = useState<string>('');
  const [filter, setFilter] = useState<TicketFilterType>('total_tickets');

  const deleteTicket = (id: number) => {
    setTickets((current) => current.filter((ticket) => ticket.Id !== id));
  };

  const addTicket = (newTicket: TicketType) => {
    setTickets((current) => [newTicket, ...current]);
  };

  return (
    <TicketContext.Provider
      value={{
        tickets,
        deleteTicket,
        setTicketSearch,
        ticketSearch,
        filter,
        setFilter,
        addTicket,
      }}
    >
      {children}
    </TicketContext.Provider>
  );
};
