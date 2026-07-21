import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoragePort } from "../../core/library/types.js";

const DEFAULT_BUCKET = "pdfs";

/**
 * Real StoragePort backed by Supabase Storage. When `prefix` is set (the
 * owner's user id), files land under `<prefix>/<uuid>/<filename>` so storage
 * RLS can gate access by the first path segment.
 */
export function supabaseStorage(
  client: SupabaseClient,
  bucket: string = DEFAULT_BUCKET,
  prefix?: string,
): StoragePort {
  return {
    async put({ bytes, filename }) {
      const dir = prefix ? `${prefix}/${crypto.randomUUID()}` : crypto.randomUUID();
      const path = `${dir}/${filename}`;
      const { error } = await client.storage
        .from(bucket)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (error) throw new Error(`storage.put failed: ${error.message}`);
      return { ref: `${bucket}/${path}` };
    },
  };
}
