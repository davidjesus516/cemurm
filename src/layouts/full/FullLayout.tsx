import { FC } from 'react';
import Sidebar from './vertical/sidebar/Sidebar';
import Header from './vertical/header/Header';
import { SidebarInset, SidebarProvider } from 'src/components/ui/sidebar';
import Footer from './shared/footer/Footer';
import { Outlet } from 'react-router-dom';

const FullLayout: FC = () => {
  return (
    <SidebarProvider
      defaultOpen={true}
      style={{ '--sidebar-width-icon': '52px' } as React.CSSProperties}
    >
      <Sidebar />

      <SidebarInset className="m-2 lg:m-3 overflow-hidden rounded-cem-lg border border-cem-hover bg-cem-base">
        {/* Top Header  */}
        <Header />

        {/* Body Content  */}
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          <div className="w-full mx-auto container">
            <div className="min-h-[calc(100vh-140px)]">
              <Outlet />
            </div>
            <div className="pt-6">
              <Footer />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default FullLayout;
