import { NextResponse } from 'next/server'

// GET — return which integrations are configured (env vars present)
export async function GET() {
  return NextResponse.json({
    hubspot: !!process.env.HUBSPOT_ACCESS_TOKEN,
    openai: !!process.env.OPENAI_API_KEY,
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  })
}
