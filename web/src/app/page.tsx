import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/chat");
    }
  } catch {
    // Supabase not configured yet — fall through to login
  }

  redirect("/login");
}
