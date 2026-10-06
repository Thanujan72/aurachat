import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { senderId, receiverId } = await req.json();

    if (!senderId || !receiverId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Friend anupina, namma innum padikkatha messages ellathaiyum "Read (true)" nu maathuthu
    const updatedMessages = await prisma.message.updateMany({
      where: {
        senderId: senderId, // Friend
        receiverId: receiverId, // Namma
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ success: true, count: updatedMessages.count });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
