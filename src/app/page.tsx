import Link from "next/link";

const CARDS = [
  { href: "/leads", title: "Leads", text: "See all leads pulled from your Google Sheets, filter by project, search." },
  { href: "/setup", title: "Setup", text: "Add projects and link Google Sheets to them." },
];

export default function Home() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CARDS.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="rounded-lg border border-slate-200 bg-white p-6 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-lg font-semibold">{c.title} →</h2>
          <p className="mt-1 text-sm text-slate-600">{c.text}</p>
        </Link>
      ))}
    </div>
  );
}
