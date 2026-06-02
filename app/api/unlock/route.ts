import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Paywall unlock API (MVP stub).
 *
 * Dev: set PAYWALL_BYPASS=true in .env.local to unlock without payment.
 *
 * Production (Stripe — wire later):
 * 1. Create Checkout Session with metadata.renderId
 * 2. On success redirect to /studio?session_id=cs_...
 * 3. Verify session here:
 *    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *    const session = await stripe.checkout.sessions.retrieve(body.sessionId);
 *    if (session.payment_status !== "paid") return 402;
 */
export async function POST(req: NextRequest) {
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

  if (sessionId) {
    // TODO: Stripe Checkout session verification
    return NextResponse.json(
      {
        message:
          "Stripe not configured. Set PAYWALL_BYPASS=true for local dev.",
      },
      { status: 402 },
    );
  }

  return NextResponse.json(
    {
      paymentRequired: true,
      message: "Complete payment to download your GIF.",
    },
    { status: 402 },
  );
}
