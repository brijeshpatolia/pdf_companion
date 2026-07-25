import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseProgress } from "@/adapters/supabase/supabaseProgress.js";
import { getProgress } from "@/core/progress/progress.js";
import Reader from "./Reader";

export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  try {
    const client = await supabaseUser();
    const { data: book } = await client
      .from("books")
      .select("title")
      .eq("id", bookId)
      .single();
    return { title: book?.title ?? "Reader" };
  } catch {
    return { title: "Reader" };
  }
}

export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { bookId } = await params;
  const { page: pageParam } = await searchParams;
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/login?redirect=/reader/${bookId}`);

  // RLS returns nothing unless the signed-in user owns this book.
  const { data: book } = await client
    .from("books")
    .select("id,title,page_count,file_ref,format")
    .eq("id", bookId)
    .single();

  if (!book) {
    return (
      <main style={{ padding: "2rem" }}>
        <p>Book not found.</p>
        <Link href="/">← Library</Link>
      </main>
    );
  }

  const format = book.format === "epub" ? "epub" : "pdf";

  // PDFs render from a short-lived signed URL (the bucket is private). EPUBs
  // render from page text fetched on demand, so they need no file URL.
  let fileUrl = "";
  if (format === "pdf") {
    const slash = book.file_ref.indexOf("/");
    const bucket = book.file_ref.slice(0, slash);
    const path = book.file_ref.slice(slash + 1);
    const { data: signed } = await client.storage.from(bucket).createSignedUrl(path, 3600);
    fileUrl = signed?.signedUrl ?? "";
  }

  const progress = await getProgress(book.id, supabaseProgress(client));

  // A `?page=N` deep link (e.g. from a cross-book Q&A citation) opens straight
  // to that page; otherwise resume where the reader left off.
  const requestedPage = Number(pageParam);
  const initialPage =
    Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= book.page_count
      ? requestedPage
      : progress.currentPage;

  return (
    <Reader
      bookId={book.id}
      title={book.title}
      pageCount={book.page_count}
      format={format}
      fileUrl={fileUrl}
      initialPage={initialPage}
      furthestReadPage={progress.furthestReadPage}
    />
  );
}
