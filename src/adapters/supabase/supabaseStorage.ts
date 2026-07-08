import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoragePort } from "../../core/library/types.js";

const DEFAULT_BUCKET = "pdfs";

/** Real StoragePort backed by Supabase Storage. */
export function supabaseStorage(
  client: SupabaseClient,
  bucket: string = DEFAULT_BUCKET,
): StoragePort {
  return {
    async put({ bytes, filename }) {
      const path = `${crypto.randomUUID()}/${filename}`;
      const { error } = await client.storage
        .from(bucket)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (error) throw new Error(`storage.put failed: ${error.message}`);
      return { ref: `${bucket}/${path}` };
    },
  };
}
