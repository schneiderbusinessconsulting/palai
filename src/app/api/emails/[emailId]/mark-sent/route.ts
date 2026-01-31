import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = await createClient()

    // Parse optional body with edited response
    let editedResponse: string | null = null
    try {
      const body = await request.json()
      editedResponse = body.editedResponse || null
    } catch {
      // No body sent, that's fine
    }

    // If edited response provided, save it to the draft
    if (editedResponse) {
      const { error: draftError } = await supabase
        .from('email_drafts')
        .update({
          edited_response: editedResponse,
          status: 'edited',
          updated_at: new Date().toISOString(),
        })
        .eq('email_id', emailId)

      if (draftError) {
        console.error('Save draft edit error:', draftError)
      }
    }

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

// Save edited draft without marking as sent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { editedResponse } = await request.json()
    const supabase = await createClient()

    const { error } = await supabase
      .from('email_drafts')
      .update({
        edited_response: editedResponse,
        status: 'edited',
        updated_at: new Date().toISOString(),
      })
      .eq('email_id', emailId)

    if (error) {
      console.error('Save draft error:', error)
      return NextResponse.json(
        { error: 'Failed to save draft' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Entwurf gespeichert',
    })
  } catch (error) {
    console.error('Save draft error:', error)
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    )
  }
}
