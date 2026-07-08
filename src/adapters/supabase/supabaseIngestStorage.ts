import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestStoragePort } from "../../core/ingestion/types.js";

export function supabaseIngestStorage(client: SupabaseClient): IngestStoragePort {
  return {
    async download(fileRef) {
      const slash = fileRef.indexOf("/");
      const bucket = fileRef.slice(0, slash);
      const path = fileRef.slice(slash + 1);

      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) throw new Error(`Failed to download: ${error?.message}`);

      return new Uint8Array(await data.arrayBuffer());
    },
  };
}
