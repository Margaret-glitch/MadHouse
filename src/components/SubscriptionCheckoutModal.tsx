import React, { useState } from 'react';
import {
  X,
  Crown,
  CheckCircle,
  WarningCircle,
  Sparkle,
  LockOpen,
  SpinnerGap
} from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import {
  initiatePaystackSubscription,
  SubscriptionRecord,
  SUBSCRIPTION_PLANS
} from '../services/paystack';

interface SubscriptionCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (sub: SubscriptionRecord) => void;
}

export const SubscriptionCheckoutModal: React.FC<SubscriptionCheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, isVip, subscription, refreshSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'vip_monthly'>('vip_monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async (planId: 'weekly' | 'vip_monthly') => {
    if (!user) {
      setError('Please sign in or create an account first.');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      await initiatePaystackSubscription({
        user,
        planId,
        onSuccess: async (sub) => {
          setIsProcessing(false);
          await refreshSubscription();
          onSuccess?.(sub);
          onClose();
        },
        onClose: () => {
          setIsProcessing(false);
        },
        onError: (err) => {
          setIsProcessing(false);
          setError(err.message || 'Payment initiation failed. Please try again.');
        }
      });
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.message || 'Could not launch payment gateway.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-neutral-900 border border-white/15 p-6 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#E5C058]/10 border border-[#E5C058]/40 mx-auto flex items-center justify-center text-[#E5C058] mb-3 shadow-[0_0_25px_rgba(229,192,88,0.25)]">
            <Crown size={28} weight="fill" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Unlock Unlimited Access
          </h2>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Enjoy full movie runtimes, all series episodes, unlimited downloads, and VIP priority streaming.
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
            <WarningCircle size={16} weight="bold" className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Card 1: Weekly #950 */}
          <div
            onClick={() => setSelectedPlan('weekly')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-center select-none ${
              selectedPlan === 'weekly'
                ? 'bg-neutral-800 border-[#E5C058]/60 shadow-[0_0_15px_rgba(229,192,88,0.15)] ring-1 ring-[#E5C058]/40'
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block">Weekly</span>
              <div className="text-2xl font-black text-white tracking-tight mt-0.5">#950</div>
              <span className="text-[10px] text-gray-400">7 Days</span>
            </div>
            <div className="text-[10px] text-gray-300 mt-3 pt-2 border-t border-white/10 space-y-1">
              <div>1 Account</div>
              <div>Unlimited Downloads</div>
              <div>HD Player</div>
            </div>
          </div>

          {/* Card 2: VIP Monthly #3500 (Best Value) */}
          <div
            onClick={() => setSelectedPlan('vip_monthly')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-center select-none relative ${
              selectedPlan === 'vip_monthly'
                ? 'bg-[#E5C058] text-black border-[#E5C058] shadow-[0_0_25px_rgba(229,192,88,0.35)] ring-2 ring-[#E5C058]'
                : 'bg-[#E5C058]/10 text-white border-[#E5C058]/40 hover:bg-[#E5C058]/20'
            }`}
          >
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-black text-[#E5C058] border border-[#E5C058] text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              BEST VALUE
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-tight block ${selectedPlan === 'vip_monthly' ? 'text-black/75' : 'text-[#E5C058]'}`}>
                VIP Monthly
              </span>
              <div className={`text-2xl font-black tracking-tight mt-0.5 ${selectedPlan === 'vip_monthly' ? 'text-black' : 'text-white'}`}>
                #3500
              </div>
              <span className={`text-[10px] ${selectedPlan === 'vip_monthly' ? 'text-black/75' : 'text-gray-400'}`}>30 Days VIP</span>
            </div>
            <div className={`text-[10px] mt-3 pt-2 border-t space-y-1 ${
              selectedPlan === 'vip_monthly' ? 'border-black/20 text-black font-semibold' : 'border-white/10 text-gray-300'
            }`}>
              <div>Multi Account</div>
              <div>YT Premium</div>
              <div>All Series & Movies</div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          disabled={isProcessing}
          onClick={() => handleCheckout(selectedPlan)}
          className="w-full py-3.5 rounded-xl bg-[#E5C058] hover:bg-[#ebd06a] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-[0_4px_20px_rgba(229,192,88,0.4)] active:scale-98 transition-all cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <SpinnerGap size={18} weight="bold" className="animate-spin text-black" />
              <span>Connecting to Paystack...</span>
            </>
          ) : (
            <>
              <span>Activate {selectedPlan === 'weekly' ? 'Weekly Pass (#950)' : 'VIP Monthly (#3500)'}</span>
              <LockOpen size={16} weight="fill" className="text-black" />
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-gray-400 mt-3 flex items-center justify-center space-x-1">
          <Sparkle size={12} weight="fill" className="text-[#E5C058]" />
          <span>Instant activation via Paystack secure gateway</span>
        </p>
      </div>
    </div>
  );
};
