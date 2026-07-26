/**
 * The icon set.
 *
 * Inline SVG rather than an icon package: there are ~20 of these, they never
 * change, and shipping a dependency to draw them would cost more than it saves.
 * Every glyph is drawn on a 24×24 grid with `currentColor` strokes, so an icon
 * inherits the colour and size of whatever it sits in and a button doesn't have
 * to know anything about it.
 *
 * These replaced the emoji this UI used to use for chrome. Emoji render as a
 * different typeface on every platform, carry colours that fight the palette,
 * and sit on the baseline like text rather than aligning to a label — which is
 * exactly why interfaces built from them look improvised.
 */

export type IconName =
  | "book"
  | "library"
  | "chat"
  | "cards"
  | "note"
  | "link"
  | "search"
  | "chart"
  | "users"
  | "sparkle"
  | "mail"
  | "check"
  | "close"
  | "arrow-left"
  | "arrow-right"
  | "chevron-left"
  | "chevron-right"
  | "download"
  | "share"
  | "highlight"
  | "eye"
  | "trash"
  | "plus"
  | "seedling"
  | "spinner";

interface Props {
  name: IconName;
  /** Matches the surrounding text size by default. */
  size?: number | string;
  className?: string;
  /** Set when the icon is the only content of a control. */
  label?: string;
}

// Paths only — the wrapper supplies the frame, stroke, and accessibility.
const PATHS: Record<IconName, React.ReactNode> = {
  book: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z" />
      <path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H19" />
    </>
  ),
  library: (
    <>
      <path d="M4 3v18M9 3v18" />
      <path d="M13.5 3.8 19 5l-3.2 15.2L10.3 19z" />
    </>
  ),
  chat: <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.3-4.4A7.5 7.5 0 1 1 20 12z" />,
  cards: (
    <>
      <rect x="8" y="3" width="12" height="16" rx="2" />
      <path d="M16 21H6a2 2 0 0 1-2-2V7" />
    </>
  ),
  note: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.9 6.4" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.4-1.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M18 20a6.6 6.6 0 0 0-2-4.7" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  "arrow-left": <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14m0 0-6-6m6 6-6 6" />,
  "chevron-left": <path d="m14.5 5-7 7 7 7" />,
  "chevron-right": <path d="m9.5 5 7 7-7 7" />,
  download: <path d="M12 3v12m0 0 5-5m-5 5-5-5M4 20h16" />,
  share: (
    <>
      <path d="M12 15V3m0 0 4 4m-4-4L8 7" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </>
  ),
  highlight: (
    <>
      <path d="m13 3 8 8-8.5 8.5H6L3.5 17z" />
      <path d="M8.5 7.5 16.5 15.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  seedling: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14C12 9.6 8.4 6 4 6c0 4.4 3.6 8 8 8z" />
      <path d="M12 14c0-3.9 3.1-7 7-7 0 3.9-3.1 7-7 7z" />
    </>
  ),
  spinner: <path d="M12 3a9 9 0 1 0 9 9" />,
};

export default function Icon({ name, size = "1em", className, label }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // Optical alignment: icons sit a touch high next to text without this.
      style={{ display: "inline-block", verticalAlign: "-0.135em", flexShrink: 0 }}
    >
      {label ? <title>{label}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
