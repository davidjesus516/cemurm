import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { } from 'lucide-react'

type MostUsedSongsWidgetProps = {
  songs: Array<{
    id: string
    title: string
    artist: string
    playCount: number
    key: string
    bpm: number
  }>
  onViewAll?: () => void
}

export const MostUsedSongsWidget: React.FC<MostUsedSongsWidgetProps> = ({
  songs,
  onViewAll
}) => {
  const sorted = [...songs].sort((a, b) => b.playCount - a.playCount).slice(0, 5)

  return (
    <Card className='rounded-lg border border-cem-elevated bg-cem-surface shadow-sm'>
      <CardHeader className='flex items-center gap-2 pb-2 border-b border-cem-elevated'>
        <svg className='size-4' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
          <path d='M22 11.08V12a10 10 0 1 1-5.94-9.14' />
          <polyline points='22 4 12 14 9 11' />
        </svg>
        <span className='text-sm font-medium text-cem-text'>
          Canciones más usadas
        </span>
        <span className='ml-auto text-xs text-cem-secondary hover:text-cem-amber transition-colors'>
          Ver todas
        </span>
      </CardHeader>
      <CardContent className='pt-0'>
        {sorted.length === 0 && (
          <p className='text-xs text-cem-secondary py-4'>
            No hay datos de reproducción aún. Comienza a tocar tus canciones.
          </p>
        )}
        {sorted.length > 0 && (
          <ul className='divide-y divide-cem-elevated mt-3'>
            {sorted.map((song) => (
              <li key={song.id} className='px-3 py-2 flex items-center justify-between hover:bg-cem-surface/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <svg className='size-3 text-cem-amber' viewBox='0 0 24 24' fill='currentColor'>
                    <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.21L7 14.14 2 9.27l6.91-1.02L12 2z' />
                  </svg>
                  <span className='text-sm font-medium text-cem-text'>{song.title}</span>
                  <span className='text-xs text-cem-secondary ml-2'>({song.artist})</span>
                </div>
                <span className='text-xs text-cem-amber'>{song.playCount}×</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}