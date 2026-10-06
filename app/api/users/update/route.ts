import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Frontend-la irunthu anuppura data-va vangurom
    const { userId, fullName, avatarUrl } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Database-la user-oda Profile-a update panrom
    const updatedProfile = await prisma.profile.update({
      where: { id: userId },
      data: {
        fullName: fullName,
        avatarUrl: avatarUrl,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
