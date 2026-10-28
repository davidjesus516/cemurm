import IconLibrary from 'src/components/icons/iconify-icons'
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp'
import DemoNotice from 'src/components/shared/DemoNotice'

const BCrumb = [
  { to: '/dashboard', title: 'Home' },
  { title: 'Icon library' },
]

const IconLibraryPage = () => {
  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbComp title='Icon library' items={BCrumb} />
      <DemoNotice>
        Icon library reference — this gallery documents the Iconify Solar set
        available to CEMURM interfaces. It is static documentation and does not
        change app data.
      </DemoNotice>
      <IconLibrary />
    </div>
  )
}

export default IconLibraryPage
