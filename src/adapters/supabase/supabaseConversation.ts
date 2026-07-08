import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationPort, Message } from "../../core/chat/types.js";

export function supabaseConversation(client: SupabaseClient): ConversationPort {
  return {
    async load(bookId) {
      const { data, error } = await client
        .from("messages")
        .select("role, content")
        .eq("book_id", bookId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(`Failed to load conversation: ${error.message}`);
      return (data ?? []) as Message[];
    },

    async append(bookId, messages) {
      const rows = messages.map((m) => ({
        book_id: bookId,
        role: m.role,
        content: m.content,
      }));

      const { error } = await client.from("messages").insert(rows);
      if (error) throw new Error(`Failed to append messages: ${error.message}`);
    },
  };
}
