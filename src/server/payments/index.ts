export type ChargeRequest = {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: string;
  email: string;
};

export type ChargeResult = {
  status: "paid" | "failed";
  reference: string;
  failureReason?: string;
};

export interface PaymentProvider {
  readonly id: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

/**
 * Development provider. It records a reference and always succeeds, which is
 * enough to exercise the order lifecycle without a payment dependency.
 */
const mockProvider: PaymentProvider = {
  id: "mock",
  async charge(request) {
    return { status: "paid", reference: `mock_${request.orderNumber}` };
  },
};

export const paymentProvider: PaymentProvider = mockProvider;

export function isMockPayment(): boolean {
  return paymentProvider.id === "mock";
}
