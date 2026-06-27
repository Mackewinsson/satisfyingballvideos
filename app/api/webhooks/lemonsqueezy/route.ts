import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    console.error("LEMON_SQUEEZY_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ message: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-signature");
  if (!signature) {
    return NextResponse.json({ message: "No signature provided" }, { status: 401 });
  }

  const rawBody = await req.text();
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const eventName = event.meta?.event_name;
  
  if (eventName === "order_created") {
    const customData = event.meta?.custom_data;
    const userId = customData?.user_id;
    const renderId = customData?.render_id;

    if (userId && renderId) {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const existingRenders = (user.privateMetadata?.unlockedRenders as string[]) || [];
        
        if (!existingRenders.includes(renderId)) {
          await client.users.updateUserMetadata(userId, {
            privateMetadata: {
              ...user.privateMetadata,
              unlockedRenders: [...existingRenders, renderId],
            },
          });
          console.log(`Unlocked renderId ${renderId} for user ${userId}`);
        }
      } catch (error) {
        console.error("Failed to update Clerk user metadata:", error);
        return NextResponse.json({ message: "Failed to process order" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ message: "Webhook processed" });
}
