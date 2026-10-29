import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EllipsisVertical, Music } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PerformerRow } from '../table-data'

interface StripedRowTableProps {
  rows: PerformerRow[]
}

function StripedRowTable({ rows }: StripedRowTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Striped-Row Table</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-sm font-semibold'>Song</TableHead>
                <TableHead className='text-sm font-semibold'>Key</TableHead>
                <TableHead className='text-sm font-semibold'>Status</TableHead>
                <TableHead className='text-sm font-semibold'>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='py-6 text-sm text-cem-secondary-elevated'
                  >
                    No songs yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow
                  key={row.key}
                  className='group/row bg-transparent odd:bg-transparent even:bg-cem-hover'
                >
                  <TableCell className='ps-3 min-w-[200px]'>
                    <div className='flex gap-3 items-center'>
                      <span className='flex h-10 w-10 items-center justify-center rounded-full border border-cem-hover shrink-0'>
                        <Music size={18} />
                      </span>
                      <div>
                        <h6 className='text-sm font-semibold mb-1'>{row.title}</h6>
                        <p className='text-xs text-cem-secondary-elevated font-medium'>
                          {row.subtitle}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <p className='text-cem-secondary-elevated text-sm font-medium'>
                      {row.meta}
                    </p>
                  </TableCell>

                  <TableCell>
                    <Badge
                      className={`text-sm rounded-full py-1 px-3 justify-center ${row.badgeClass}`}
                    >
                      {row.badge}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Link
                      to={row.href}
                      aria-label={`Open ${row.title}`}
                      className='h-9 w-9 flex justify-center items-center rounded-full hover:bg-cem-hover hover:text-cem-amber cursor-pointer'
                    >
                      <EllipsisVertical size={22} />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default StripedRowTable
