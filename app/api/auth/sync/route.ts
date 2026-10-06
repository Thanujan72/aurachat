import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { id, email } = await req.json()

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing user data' }, { status: 400 })
    }

    // Upsert: User already irundha update pannum, illana puthusa create pannum
    const profile = await prisma.profile.upsert({
      where: { id: id },
      update: { email: email },
      create: {
        id: id,
        email: email,
        fullName: email.split('@')[0], // Email-oda muthal part-a peru maari vechukkum
      }
    })

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error("Profile sync error:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}