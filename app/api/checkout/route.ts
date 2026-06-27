import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ message: "Sign in required" }, { status: 401 });
  }

  let body: { renderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { renderId } = body;
  if (!renderId) {
    return NextResponse.json({ message: "renderId required" }, { status: 400 });
  }

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
  const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID;

  if (!apiKey || !storeId || !variantId) {
    return NextResponse.json(
      { message: "Lemon Squeezy is not configured." },
      { status: 500 }
    );
  }

  lemonSqueezySetup({ apiKey });

  try {
    const origin = req.headers.get("origin") || req.nextUrl.origin;
    
    const { data, error } = await createCheckout(storeId, variantId, {
      checkoutData: {
        custom: {
          user_id: userId,
          render_id: renderId,
        },
      },
      productOptions: {
        redirectUrl: `${origin}/studio?session_id=ls_${renderId}`,
        receiptButtonText: "Return to App",
        receiptThankYouNote: "Thank you for unlocking your custom animation!",
      },
    });

    if (error) {
      console.error("Lemon Squeezy Checkout Error:", error);
      return NextResponse.json(
        { message: "Failed to create checkout session." },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkoutUrl: data?.data?.attributes?.url });
  } catch (error) {
    console.error("Checkout creation failed:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
