import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 1. Pazhaya messages-a thedi edukkura API
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const user1 = searchParams.get('user1') // Namma ID
    const user2 = searchParams.get('user2') // Friend ID

    if (!user1 || !user2) {
      return NextResponse.json({ error: 'Missing user IDs' }, { status: 400 })
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user1, receiverId: user2 },
          { senderId: user2, receiverId: user1 }
        ]
      },
      orderBy: { createdAt: 'asc' } // Pazhaya message mela, puthu message keela
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// 2. Puthu message-a database-la save panra API (Updated for Image & Text)
export async function POST(req: Request) {
  try {
    const { senderId, receiverId, content, messageType = 'text' } = await req.json()

    if (!senderId || !receiverId || !content) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    const newMessage = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
        messageType // 'text' allathu 'image' nu save aagum
      }
    })

    return NextResponse.json(newMessage)
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}