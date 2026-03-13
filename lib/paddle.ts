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

// Module-level callbacks — updated before each checkout open
// because eventCallback must live on Paddle.Initialize(), not Paddle.Checkout.open()
let pendingOnSuccess: ((email: string) => void) | undefined;
let pendingOnClose: (() => void) | undefined;
// True if checkout.closed fired before onPaddleClose was registered
let checkoutAlreadyClosed = false;

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
        // Auto-close Paddle's success screen so our animation can take over
        setTimeout(() => window.Paddle?.Checkout?.close(), 1500);
      }
      if (event.name === "checkout.closed") {
        if (pendingOnClose) {
          // applyPlan already ran — fire immediately
          pendingOnClose();
          pendingOnClose = undefined;
          checkoutAlreadyClosed = false;
        } else {
          // applyPlan hasn't run yet — remember for when it does
          checkoutAlreadyClosed = true;
        }
      }
    },
  });
}

export function onPaddleClose(cb: () => void) {
  if (checkoutAlreadyClosed) {
    // Paddle overlay already closed before we got here — fire now
    checkoutAlreadyClosed = false;
    cb();
  } else {
    pendingOnClose = cb;
  }
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
  pendingOnClose = undefined;
  checkoutAlreadyClosed = false;

  setTimeout(() => {
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: email
        ? { email, address: { countryCode: "US" } }
        : undefined,
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
