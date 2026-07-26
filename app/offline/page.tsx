import Link from "next/link";
import Icon from "../components/Icon";

export const metadata = { title: "Offline" };

/**
 * What an installed app shows when it's opened with no connection.
 *
 * It says the one true thing — your books are on the server, so they need one
 * — rather than implying anything was lost. The service worker keeps this page
 * cached precisely so this moment isn't the browser's error page.
 */
export default function OfflinePage() {
  return (
    <main className="gate">
      <div className="gate-card">
        <span className="gate-sent-mark" aria-hidden="true">
          <Icon name="book" size={20} />
        </span>
        <h1 className="gate-title">No connection</h1>
        <p className="gate-sub">
          Your library lives on the server, so reading needs a connection. Nothing you&apos;ve kept
          is lost — highlights, notes and answers are all still there.
        </p>
        <div className="gate-actions">
          <Link href="/" className="btn-primary btn-sm">
            Try again
          </Link>
        </div>
      </div>
    </main>
  );
}
