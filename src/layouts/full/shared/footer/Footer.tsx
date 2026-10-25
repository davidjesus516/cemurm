import { Link } from "react-router-dom";


type SearchType = {
    title: string;
    href: string;
};

const searchSugg: SearchType[] = [
    { title: "Support", href: "https://shadcndashboard.dev/support" },
    { title: "License", href: "https://shadcndashboard.dev/license" },
];

export default function Footer() {
    return (
        <div className="flex md:flex-row flex-col items-center justify-between gap-3 text-center">
            <p className="text-sm text-cem-secondary-elevated">
                © 2026 by{" "}
                <Link
                    to="https://www.wrappixel.com/" target="_blank"
                    className="hover:text-cem-amber text-cem-secondary-elevated"
                >
                    shadcndashboard
                </Link>
                , creating a better web for you.
            </p>

            <div className="flex gap-4">
                {searchSugg.map((item, index) => (
                    <Link
                        key={index}
                        target="_blank"
                        to={item.href}
                        className="text-sm hover:text-cem-amber text-cem-secondary-elevated"
                    >
                        {item.title}
                    </Link>
                ))}
            </div>
        </div>
    );
}
