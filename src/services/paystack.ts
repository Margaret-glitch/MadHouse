/**
 * Paystack Integration & Subscription Service for MadHouse
 * Handles checkout initialization with Paystack Pop, pending transaction logging to Breacher DB,
 * and subscription entitlement management.
 */

import { BASE_DB, createDocument, readDocument } from './madhouseDb';
import { MadHouseUser } from './madhouseAuth';

export const PAYSTACK_PUBLIC_KEY = 'pk_live_8185c8c5269f36e4dde4094f7196ce3d37a148e5';

export interface PlanConfig {
  id: string;
  name: string;
  priceLabel: string;
  amount: number; // In Naira
  amountKobo: number; // In Kobo for Paystack
  termDays: number;
  badge?: string;
  available: boolean;
  description: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, PlanConfig> = {
  weekly: {
    id: 'weekly',
    name: 'Weekly Pass',
    priceLabel: '₦950',
    amount: 950,
    amountKobo: 95000,
    termDays: 7,
    available: true,
    description: '7 Days Full Access',
    features: [
      'Unlimited Downloads',
      'HD Streaming',
      'YouTube & Movies',
      '1 Account'
    ]
  },
  vip_monthly: {
    id: 'vip_monthly',
    name: 'VIP Monthly',
    priceLabel: '₦3,500',
    amount: 3500,
    amountKobo: 350000,
    termDays: 30,
    badge: 'BEST VALUE',
    available: true,
    description: '30 Days Full VIP Access',
    features: [
      'Multi Account Sync',
      'Unlimited Downloads',
      'HD/FHD Streaming',
      'YT Premium Included',
      'Priority Speeds'
    ]
  },
  smart_plan: {
    id: 'smart_plan',
    name: 'Smart Plan',
    priceLabel: 'Soon',
    amount: 0,
    amountKobo: 0,
    termDays: 30,
    badge: 'SOON',
    available: false,
    description: 'HD, Smart TV Usage & More',
    features: [
      'HD & 4K Ultra Quality',
      'Smart TV Usage',
      'Cast & AirPlay Support',
      'Multi-room Sync',
      'Shared Profiles'
    ]
  }
};

export interface SubscriptionRecord {
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number;
  reference: string;
  status: 'active' | 'expired' | 'none';
  entitlement: boolean;
  startDate: string;
  expiryDate: string;
  daysLeft: number;
  updatedAt: string;
}

export interface TransactionRecord {
  reference: string;
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number; // in kobo
  amountNaira: number;
  termDays: number;
  status: 'pending' | 'success' | 'verified' | 'failed' | 'abandoned';
  createdAt: string;
  updatedAt: string;
  paystackResponse?: any;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref: string;
        metadata?: any;
        callback: (response: { reference: string; status?: string; trans?: string }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

/**
 * Sanitize userId or email for doc paths
 */
export function sanitizeUserKey(identifier: string): string {
  return identifier.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Dynamically ensures Paystack Inline script is loaded
 */
export async function loadPaystackScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.PaystackPop) {
    return true;
  }

  return new Promise((resolve) => {
    const existing = document.getElementById('paystack-inline-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'paystack-inline-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Record a pending transaction in Breacher DB and queue
 */
export async function logPendingTransaction(
  user: MadHouseUser,
  plan: PlanConfig,
  reference: string
): Promise<TransactionRecord> {
  const now = new Date().toISOString();
  const tx: TransactionRecord = {
    reference,
    userId: user.id || user.email,
    userEmail: user.email,
    planId: plan.id,
    planName: plan.name,
    amount: plan.amountKobo,
    amountNaira: plan.amount,
    termDays: plan.termDays,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };

  try {
    // 1. Save specific transaction document: userData/transactions/{ref}.json
    await createDocument(`userData/transactions/${reference}`, tx);

    // 2. Append to pending transactions queue: userData/pending_transactions.json
    const queueDoc = (await readDocument<{ transactions?: TransactionRecord[] }>(
      'userData/pending_transactions'
    )) || { transactions: [] };

    const transactions = Array.isArray(queueDoc.transactions) ? queueDoc.transactions : [];
    // Filter out duplicate ref if any
    const updatedQueue = [tx, ...transactions.filter((t) => t.reference !== reference)].slice(0, 100);

    await createDocument('userData/pending_transactions', {
      updatedAt: now,
      transactions: updatedQueue
    });
  } catch (err) {
    console.warn('Failed to log pending transaction to Breacher DB:', err);
  }

  return tx;
}

/**
 * Grant subscription entitlement in Breacher DB & local state
 */
export async function grantSubscriptionEntitlement(
  user: MadHouseUser,
  plan: PlanConfig,
  reference: string,
  paystackResponse?: any
): Promise<SubscriptionRecord> {
  const now = new Date();
  const expiry = new Date(now.getTime() + plan.termDays * 24 * 60 * 60 * 1000);
  const userKey = sanitizeUserKey(user.id || user.email);

  const sub: SubscriptionRecord = {
    userId: user.id || user.email,
    userEmail: user.email,
    planId: plan.id,
    planName: plan.name,
    amount: plan.amountKobo,
    reference,
    status: 'active',
    entitlement: true,
    startDate: now.toISOString(),
    expiryDate: expiry.toISOString(),
    daysLeft: plan.termDays,
    updatedAt: now.toISOString()
  };

  // 1. Persist directly in Breacher DB: userData/subscription_{userKey}.json
  try {
    await createDocument(`userData/subscription_${userKey}`, sub);

    // 2. Update master active subscriptions registry: userData/users_subscriptions.json
    const master = (await readDocument<{ subscriptions?: Record<string, SubscriptionRecord> }>(
      'userData/users_subscriptions'
    )) || { subscriptions: {} };

    const subs = master.subscriptions || {};
    subs[userKey] = sub;

    await createDocument('userData/users_subscriptions', {
      updatedAt: now.toISOString(),
      subscriptions: subs
    });

    // 3. Update transaction status to verified/success
    const txUpdate: Partial<TransactionRecord> = {
      status: 'verified',
      updatedAt: now.toISOString(),
      paystackResponse
    };
    await createDocument(`userData/transactions/${reference}`, {
      reference,
      userId: user.id || user.email,
      userEmail: user.email,
      planId: plan.id,
      planName: plan.name,
      amount: plan.amountKobo,
      amountNaira: plan.amount,
      termDays: plan.termDays,
      status: 'verified',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      paystackResponse
    });

    // 4. Remove from pending transactions queue
    const queueDoc = await readDocument<{ transactions?: TransactionRecord[] }>(
      'userData/pending_transactions'
    );
    if (queueDoc && Array.isArray(queueDoc.transactions)) {
      const remaining = queueDoc.transactions.filter((t) => t.reference !== reference);
      await createDocument('userData/pending_transactions', {
        updatedAt: now.toISOString(),
        transactions: remaining
      });
    }
  } catch (err) {
    console.warn('Could not persist entitlement to remote Breacher DB:', err);
  }

  return sub;
}

/**
 * Fetch and validate user's current subscription strictly from Breacher DB
 */
export async function fetchUserSubscription(
  identifier?: string | null
): Promise<SubscriptionRecord | null> {
  if (!identifier) return null;
  const userKey = sanitizeUserKey(identifier);

  try {
    // ALWAYS fetch fresh document directly from Breacher DB: userData/subscription_{userKey}.json
    const remote = await readDocument<SubscriptionRecord>(`userData/subscription_${userKey}`);
    if (!remote) return null;

    // Check expiry
    const expiryTime = new Date(remote.expiryDate).getTime();
    const now = Date.now();
    const isExpired = now >= expiryTime;
    const daysLeft = isExpired ? 0 : Math.max(0, Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)));

    const updated: SubscriptionRecord = {
      ...remote,
      status: isExpired ? 'expired' : 'active',
      entitlement: !isExpired,
      daysLeft
    };

    // If status changed to expired, update Breacher DB doc
    if (isExpired && remote.status === 'active') {
      try {
        await createDocument(`userData/subscription_${userKey}`, updated);
      } catch {}
    }

    return updated;
  } catch (err) {
    console.warn('Could not fetch subscription from Breacher DB:', err);
    return null;
  }
}

/**
 * Start Paystack Pop checkout flow matching reference code 1:1
 */
export function initiatePaystackSubscription({
  user,
  planId,
  onSuccess,
  onClose,
  onError
}: {
  user: MadHouseUser;
  planId: string;
  onSuccess: (sub: SubscriptionRecord) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}): void {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    if (typeof onError === 'function') onError(new Error(`Invalid plan: ${planId}`));
    return;
  }

  if (!plan.available) {
    if (typeof onError === 'function') onError(new Error(`${plan.name} is not available for purchase yet.`));
    return;
  }

  const userEmail = user.email || 'customer@madhouse.app';
  const reference = 'MH_SUB_' + Math.floor(Math.random() * 1000000000 + 1);

  // Background transaction log
  logPendingTransaction(user, plan, reference).catch((err) =>
    console.warn('Background pending transaction log failed:', err)
  );

  const handleSuccess = (response: { reference?: string }) => {
    grantSubscriptionEntitlement(user, plan, response ? response.reference || reference : reference)
      .then((sub) => {
        if (typeof onSuccess === 'function') onSuccess(sub);
      })
      .catch((err) => {
        if (typeof onError === 'function') onError(err instanceof Error ? err : new Error(String(err)));
      });
  };

  const handleClose = () => {
    if (typeof onClose === 'function') onClose();
  };

  const paystackWindow = window as any;

  if (typeof paystackWindow.payWithPaystack === 'function') {
    paystackWindow.payWithPaystack(
      userEmail,
      plan.amount * 100,
      reference,
      handleSuccess,
      handleClose
    );
    return;
  }

  if (!paystackWindow.PaystackPop) {
    if (typeof onError === 'function') onError(new Error('Paystack Payment Gateway SDK is loading. Please try again.'));
    return;
  }

  try {
    const options = {
      key: PAYSTACK_PUBLIC_KEY,
      email: userEmail,
      amount: plan.amount * 100,
      currency: 'NGN',
      ref: reference,
      callback: handleSuccess,
      onSuccess: handleSuccess,
      onClose: handleClose,
      onCancel: handleClose
    };

    if (typeof paystackWindow.PaystackPop.setup === 'function') {
      const handler = paystackWindow.PaystackPop.setup(options);
      handler.openIframe();
    } else if (typeof paystackWindow.PaystackPop === 'function') {
      const paystack = new paystackWindow.PaystackPop();
      paystack.newTransaction(options);
    }
  } catch (err: any) {
    console.error('Paystack Pop setup error:', err);
    if (typeof onError === 'function') {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
