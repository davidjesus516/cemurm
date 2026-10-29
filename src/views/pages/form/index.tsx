import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import FormCompo from 'src/components/form';

const BCrumb = [
  { to: '/dashboard', title: 'Home' },
  { title: 'Form' },
];

function FormPage() {
  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbComp title='Form' items={BCrumb} />
      <FormCompo />
    </div>
  );
}

export default FormPage;
