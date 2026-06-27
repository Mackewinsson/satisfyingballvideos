import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Paywall unlock API (MVP stub).
 *
 * Requires a signed-in Clerk user (see proxy.ts + auth() below).
 *
 * Dev: set PAYWALL_BYPASS=true in .env.local to unlock without payment.
 *
 * Production (Stripe — wire later):
 * 1. Create Checkout Session with metadata.renderId + metadata.userId
 * 2. On success redirect to /studio?session_id=cs_...
 * 3. Verify session here:
 *    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *    const session = await stripe.checkout.sessions.retrieve(body.sessionId);
 *    if (session.payment_status !== "paid") return 402;
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ message: "Sign in required" }, { status: 401 });
  }

  let body: { renderId?: string; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { renderId, sessionId } = body;
  if (!renderId) {
    return NextResponse.json({ message: "renderId required" }, { status: 400 });
  }

  if (process.env.PAYWALL_BYPASS === "true") {
    return NextResponse.json({ unlocked: true, token: randomUUID() });
  }

  const devSecret = process.env.DEV_UNLOCK_SECRET;
  const headerSecret = req.headers.get("x-dev-unlock-secret");
  if (devSecret && headerSecret === devSecret) {
    return NextResponse.json({ unlocked: true, token: randomUUID() });
  }

  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const unlockedRenders = (user.privateMetadata?.unlockedRenders as string[]) || [];

  if (unlockedRenders.includes(renderId)) {
    return NextResponse.json({ unlocked: true, token: randomUUID() });
  }

  return NextResponse.json(
    {
      paymentRequired: true,
      message: "Complete payment to download your export.",
    },
    { status: 402 },
  );
}
