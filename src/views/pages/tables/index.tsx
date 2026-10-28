import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import BasicTable from 'src/components/tables/basic-table/BasicTable';
import CheckboxTable from 'src/components/tables/checkbox-table/CheckboxTable';
import HoverTable from 'src/components/tables/hover-table/HoverTable';
import StripedRowTable from 'src/components/tables/striped-row-table/StripedRowTable';
import DataTable from 'src/components/tables/data-table/DataTable';
import { useAdminTables } from '@/hooks/shared/useAdminTables';

const BCrumb = [
  { to: '/dashboard', title: 'Home' },
  { title: 'Tables' },
];

function TablesPage() {
  const { songs, setlists, dataTableRows } = useAdminTables();

  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbComp title='Tables' items={BCrumb} />

      <div className='grid grid-cols-12 gap-4'>
        <div className='col-span-12'>
          <BasicTable rows={setlists} />
        </div>
        <div className='col-span-12'>
          <DataTable data={dataTableRows} />
        </div>
        <div className='col-span-12'>
          <HoverTable rows={songs} />
        </div>
        <div className='col-span-12'>
          <StripedRowTable rows={songs} />
        </div>
        <div className='col-span-12'>
          <CheckboxTable rows={songs} />
        </div>
      </div>
    </div>
  );
}

export default TablesPage;
