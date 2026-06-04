export type SubscriptionTier = 'lite' | 'standard' | 'ultimate';
export type SubscriptionType = 'monthly' | 'yearly';

export interface CreatePaymentInput {
  uid: string;
  email: string;
  idToken: string;
  name?: string | null;
  phone?: string;
  tier: SubscriptionTier;
  type: SubscriptionType;
}

export async function createSubscriptionPayment(input: CreatePaymentInput): Promise<string> {
  const response = await fetch('/api/payment/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({
      uid: input.uid,
      email: input.email,
      name: input.name,
      phone: input.phone,
      tier: input.tier,
      type: input.type,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Payment gateway connection error");
  }

  if (!data?.paymentUrl) {
    throw new Error("Payment URL not returned");
  }

  return data.paymentUrl;
}
