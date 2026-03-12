export const PADDLE_PRO_PRICE_ID = "pri_01kkgn9fahgne08fqje1b8av43";
export const PADDLE_GROWTH_PRICE_ID = "pri_01kkgnafpwdvqcs1tg4b0dtegh";
export const PADDLE_TEST_PRICE_ID = "pri_01kkh9g8zsdygz5bktjsm0xj3p";
export const PADDLE_CLIENT_TOKEN = "live_d1866540f39450348fb1e72d0c2";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

// Module-level callback — updated before each checkout open
// because eventCallback must live on Paddle.Initialize(), not Paddle.Checkout.open()
let pendingOnSuccess: ((email: string) => void) | undefined;

export function initPaddle() {
  if (typeof window === "undefined" || !window.Paddle) return;
  if (window.Paddle?.Initialized) return;
  window.Paddle.Initialize({
    token: PADDLE_CLIENT_TOKEN,
    eventCallback: (event: {
      name: string;
      data?: { customer?: { email?: string } };
    }) => {
      if (event.name === "checkout.completed") {
        const customerEmail = event.data?.customer?.email ?? "";
        pendingOnSuccess?.(customerEmail);
        pendingOnSuccess = undefined;
      }
    },
  });
}

function openCheckout({
  priceId,
  email,
  clinicUrl,
  onSuccess,
}: {
  priceId: string;
  email?: string;
  clinicUrl?: string;
  onSuccess?: (email: string) => void;
}) {
  if (typeof window === "undefined" || !window.Paddle) {
    console.error("Paddle not loaded");
    return;
  }

  initPaddle();
  pendingOnSuccess = onSuccess;

  setTimeout(() => {
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: email ? { email } : undefined,
      customData: {
        clinicUrl: clinicUrl ?? "",
      },
    });
  }, 300);
}

export function openProCheckout(
  email?: string,
  clinicUrl?: string,
  onSuccess?: (email: string) => void,
) {
  openCheckout({ priceId: PADDLE_PRO_PRICE_ID, email, clinicUrl, onSuccess });
}

export function openGrowthCheckout(
  email?: string,
  clinicUrl?: string,
  onSuccess?: (email: string) => void,
) {
  openCheckout({
    priceId: PADDLE_GROWTH_PRICE_ID,
    email,
    clinicUrl,
    onSuccess,
  });
}

export function openTestCheckout(
  email?: string,
  clinicUrl?: string,
  onSuccess?: (email: string) => void,
) {
  openCheckout({
    priceId: PADDLE_TEST_PRICE_ID,
    email,
    clinicUrl,
    onSuccess,
  });
}
