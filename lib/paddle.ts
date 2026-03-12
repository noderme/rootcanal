// 🔑 Replace these with your actual Paddle Price IDs from the dashboard
// Paddle Dashboard → Catalog → Products → click product → copy Price ID
export const PADDLE_PRO_PRICE_ID = "pri_REPLACE_WITH_YOUR_PRO_PRICE_ID";
export const PADDLE_GROWTH_PRICE_ID = "pri_REPLACE_WITH_YOUR_GROWTH_PRICE_ID";

// 🔑 Replace with your Paddle Client-side token
// Paddle Dashboard → Developer → Authentication → Client-side token
export const PADDLE_CLIENT_TOKEN = "live_REPLACE_WITH_YOUR_CLIENT_TOKEN";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

let paddleInitialized = false;

export function initPaddle() {
  if (paddleInitialized || typeof window === "undefined") return;
  if (!window.Paddle) return;

  window.Paddle.Initialize({
    token: PADDLE_CLIENT_TOKEN,
  });

  paddleInitialized = true;
}

export function openCheckout({
  priceId,
  email,
  clinicUrl,
  onSuccess,
}: {
  priceId: string;
  email?: string;
  clinicUrl?: string;
  onSuccess?: () => void;
}) {
  if (typeof window === "undefined" || !window.Paddle) {
    alert("Payment system is loading. Please try again in a moment.");
    return;
  }

  initPaddle();

  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    customData: clinicUrl ? { clinicUrl } : undefined,
    settings: {
      displayMode: "overlay",
      theme: "dark",
      locale: "en",
    },
    eventCallback: (event: { name: string }) => {
      if (event.name === "checkout.completed") {
        onSuccess?.();
      }
    },
  });
}

export function openProCheckout(
  email?: string,
  clinicUrl?: string,
  onSuccess?: () => void,
) {
  openCheckout({ priceId: PADDLE_PRO_PRICE_ID, email, clinicUrl, onSuccess });
}

export function openGrowthCheckout(
  email?: string,
  clinicUrl?: string,
  onSuccess?: () => void,
) {
  openCheckout({
    priceId: PADDLE_GROWTH_PRICE_ID,
    email,
    clinicUrl,
    onSuccess,
  });
}
