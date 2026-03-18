export const PADDLE_PRO_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID!;
export const PADDLE_GROWTH_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID!;
export const PADDLE_TEST_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_TEST_PRICE_ID!;
export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!;

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
      settings: {
        displayMode: "overlay",
        theme: "dark",
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
