import Link from "next/link";
import { supabaseServer } from "@/adapters/supabase/serverClient.js";
import Reader from "./Reader";

export const runtime = "nodejs";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const client = supabaseServer();

  const { data: book } = await client
    .from("books")
    .select("id,title,page_count,file_ref")
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

  // The pdfs bucket is private, so hand the reader a short-lived signed URL.
  const slash = book.file_ref.indexOf("/");
  const bucket = book.file_ref.slice(0, slash);
  const path = book.file_ref.slice(slash + 1);
  const { data: signed } = await client.storage.from(bucket).createSignedUrl(path, 3600);

  return (
    <Reader
      bookId={book.id}
      title={book.title}
      pageCount={book.page_count}
      fileUrl={signed?.signedUrl ?? ""}
    />
  );
}
