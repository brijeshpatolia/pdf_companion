"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The nav rail.
 *
 * Replaces the scattered top-nav links each page used to carry. It appears on
 * the surfaces you move *between* — library, catalog, ask, usage — and is
 * deliberately absent from the reader, flashcards, the share page and the
 * landing page. Those are focus surfaces: the page is meant to be the only
 * thing asking for attention, and a persistent rail would compete with it.
 */

interface Item {
  href: string;
  label: string;
  /** Matches nested routes too, so /catalog?q=… still lights up "Free". */
  path: string;
  icon: React.ReactNode;
}

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Library",
    path: "/",
    icon: <path d="M4 4h5v16H4zM11 4h4v16h-4zM17.4 5l3.4.9-3.2 14.2-3.4-1z" />,
  },
  {
    href: "/catalog",
    label: "Free",
    path: "/catalog",
    icon: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  },
  {
    href: "/ask",
    label: "Ask",
    path: "/ask",
    icon: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </>
    ),
  },
  {
    href: "/usage",
    label: "Usage",
    path: "/usage",
    icon: <path d="M4 20V12M10 20V5M16 20v-6M22 20H2" />,
  },
];

export default function AppRail({ initial = "R" }: { initial?: string }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="app-rail" aria-label="Sections">
      <Link href="/" className="rail-brand" aria-label="Studiolo — library">
        S
      </Link>

      <div className="rail-items">
        {ITEMS.map((item) => {
          const active = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rail-item"
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <span className="rail-avatar" aria-hidden="true">
        {initial}
      </span>
    </nav>
  );
}
