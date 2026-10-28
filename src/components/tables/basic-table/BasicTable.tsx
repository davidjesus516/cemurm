import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EllipsisVertical, ListMusic } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PerformerRow } from '../table-data'

interface BasicTableProps {
  rows: PerformerRow[]
}

const BasicTable = ({ rows }: BasicTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setlists</CardTitle>
      </CardHeader>

      <CardContent>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-sm font-semibold'>Setlist</TableHead>
                <TableHead className='text-sm font-semibold'>Created</TableHead>
                <TableHead className='text-sm font-semibold'>Visibility</TableHead>
                <TableHead className='text-sm font-semibold'>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.length === 0 && (
                <TableRow className='border-b border-cem-hover'>
                  <TableCell
                    colSpan={4}
                    className='py-6 text-sm text-cem-secondary-elevated'
                  >
                    No setlists yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.key} className='border-b border-cem-hover'>
                  <TableCell className='min-w-[200px]'>
                    <div className='flex gap-3 items-center'>
                      <span className='flex h-10 w-10 items-center justify-center rounded-full border border-cem-hover shrink-0'>
                        <ListMusic size={18} />
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

export default BasicTable
