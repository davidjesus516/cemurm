import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="flex md:flex-row flex-col items-center justify-between gap-3 text-center">
      <p className="text-sm text-cem-secondary-elevated">
        © 2026 CEMURM — Community-Centered Musical Repertories Manager
      </p>

      <Link
        to="/"
        className="text-sm hover:text-cem-amber text-cem-secondary-elevated"
      >
        Back to app
      </Link>
    </footer>
  );
}
