import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = await createClient()

    // Update email status to sent
    const { error } = await supabase
      .from('incoming_emails')
      .update({
        status: 'sent',
      })
      .eq('id', emailId)

    if (error) {
      console.error('Mark as sent error:', error)
      return NextResponse.json(
        { error: 'Failed to mark as sent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Als gesendet markiert',
    })
  } catch (error) {
    console.error('Mark as sent error:', error)
    return NextResponse.json(
      { error: 'Failed to mark as sent' },
      { status: 500 }
    )
  }
}
