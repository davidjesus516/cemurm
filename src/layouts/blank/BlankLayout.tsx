import { Outlet } from "react-router-dom";
import ScrollToTop from "src/components/shared/ScrollToTop";

const BlankLayout = () => (
  <>
    <ScrollToTop>
      <Outlet />
    </ScrollToTop>
  </>
);

export default BlankLayout;
