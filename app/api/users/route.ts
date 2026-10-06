import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const currentUserId = searchParams.get('userId')

    const users = await prisma.profile.findMany({
      where: {
        id: {
          not: currentUserId || undefined
        }
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

