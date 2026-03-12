export const PADDLE_PRO_PRICE_ID = "pri_01kkgn9fahgne08fqje1b8av43";
export const PADDLE_GROWTH_PRICE_ID = "pri_01kkgnafpwdvqcs1tg4b0dtegh";
export const PADDLE_CLIENT_TOKEN = "live_39e3ede11adab1a0cea422ee5fc";
// 🔑 Replace these with your

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

export function initPaddle() {
  if (typeof window === "undefined" || !window.Paddle) return;
  if (window.Paddle?.Initialized) return;

  window.Paddle.Initialize({
    token: PADDLE_CLIENT_TOKEN,
  });
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

  setTimeout(() => {
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
  }, 300);
}

export function openProCheckout(
  email?: string,
  clinicUrl?: string,
  onSuccess?: () => void,
) {
  if (!PADDLE_PRO_PRICE_ID) return;
  openCheckout({ priceId: PADDLE_PRO_PRICE_ID, email, clinicUrl, onSuccess });
}

export function openGrowthCheckout(
  email?: string,
  clinicUrl?: string,
  onSuccess?: () => void,
) {
  if (!PADDLE_GROWTH_PRICE_ID) return;
  openCheckout({
    priceId: PADDLE_GROWTH_PRICE_ID,
    email,
    clinicUrl,
    onSuccess,
  });
}
