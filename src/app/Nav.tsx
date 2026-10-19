"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/leads", label: "Leads" },
  { href: "/setup", label: "Setup" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <nav className="mx-auto flex h-12 max-w-7xl items-center gap-1 px-4 text-sm">
        {LINKS.map((l) => {
          const active = path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 font-medium ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
