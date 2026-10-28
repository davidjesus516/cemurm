import type { CSSProperties } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'src/components/ui/card'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { docco, vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useTheme } from 'src/context/shadcntheme/ThemeContext'

const CODE_STYLE: CSSProperties = {
  margin: 0,
  borderRadius: '0.5rem',
  border: '1px solid var(--color-cem-hover)',
  fontSize: '0.8125rem',
  overflowX: 'auto',
}

const INSTALL_SNIPPET = 'npm i @iconify/react'

const USAGE_SNIPPET = `import { Icon } from '@iconify/react'

function MyComponent() {
  return <Icon icon='solar:arrow-right-linear' width='20' height='20' />
}`

const IconLibrary = () => {
  const { theme } = useTheme()
  const selectedStyle = theme === 'dark' ? vs2015 : docco

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iconify Solar</CardTitle>
        <CardDescription>Icons available to CEMURM interfaces.</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-6'>
        <section className='space-y-2'>
          <h5 className='text-sm font-medium text-cem-text'>Installation</h5>
          <p className='text-cem-secondary'>
            Install the Iconify React package used by the admin:
          </p>
          <SyntaxHighlighter
            language='bash'
            style={selectedStyle}
            customStyle={CODE_STYLE}
          >
            {INSTALL_SNIPPET}
          </SyntaxHighlighter>
        </section>

        <section className='space-y-2'>
          <h5 className='text-sm font-medium text-cem-text'>Usage Example</h5>
          <p className='text-cem-secondary'>
            Import an icon from the Solar set and render it at the size you need:
          </p>
          <SyntaxHighlighter
            language='tsx'
            style={selectedStyle}
            customStyle={CODE_STYLE}
          >
            {USAGE_SNIPPET}
          </SyntaxHighlighter>
        </section>

        <section className='space-y-2'>
          <h5 className='text-sm font-medium text-cem-text'>Explore Icons</h5>
          <p className='text-cem-secondary'>Browse the full Solar collection:</p>
          <div className='h-[420px] overflow-hidden rounded-lg border border-cem-hover sm:h-[650px]'>
            <iframe
              src='https://icon-sets.iconify.design/solar/'
              title='Iconify Solar icon set'
              width='100%'
              height='100%'
              loading='lazy'
              className='h-full w-full'
            />
          </div>
          <a
            href='https://icon-sets.iconify.design/solar/'
            target='_blank'
            rel='noreferrer'
            className='inline-flex text-sm font-medium text-cem-amber underline underline-offset-4 hover:text-cem-amber/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cem-secondary/50'
          >
            Open the Solar icon set in a new tab
          </a>
        </section>
      </CardContent>
    </Card>
  )
}

export default IconLibrary
