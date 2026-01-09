import { NextResponse } from 'next/server'
import { createHubSpotClient } from '@/lib/hubspot/client'

export async function GET() {
  try {
    const hubspot = createHubSpotClient()
    const owners = await hubspot.getOwners()

    return NextResponse.json({
      owners: owners.map(owner => ({
        id: owner.id,
        email: owner.email,
        name: `${owner.firstName} ${owner.lastName}`.trim() || owner.email,
      })),
    })
  } catch (error) {
    console.error('Failed to get owners:', error)
    return NextResponse.json(
      { error: 'Failed to get owners' },
      { status: 500 }
    )
  }
}
