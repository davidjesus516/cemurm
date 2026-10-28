import { Link } from "react-router-dom";
import { CemurmMark } from "./FullLogo";

const Logo = () => {
  return (
    <Link to="/dashboard" aria-label="CEMURM admin">
      <CemurmMark />
    </Link>
  );
};

export default Logo;
