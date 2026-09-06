"use client";

import { createBrowserClient } from "@supabase/ssr";
import { chaveAnonima, urlSupabase } from "./ambiente";
import type { BaseDados } from "@/lib/tipos-bd";

/** Cliente Supabase para componentes que correm no browser. */
export function clienteBrowser() {
  return createBrowserClient<BaseDados>(urlSupabase(), chaveAnonima());
}
