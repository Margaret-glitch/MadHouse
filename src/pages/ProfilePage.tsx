import React, { useState, useEffect } from 'react';
import {
  User,
  Gear,
  DownloadSimple,
  BookmarkSimple,
  Sliders,
  CaretRight,
  ShieldCheck,
  SignOut,
  SignIn
} from '@phosphor-icons/react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { VideoItem } from '../types';
import { yt, normalizeItem } from '../services/invidious';
import { AuthModal } from '../components/AuthModal';
import { getPopcornDetail } from '../services/popcornApi';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { CheckCircle, WarningCircle, Sparkle } from '@phosphor-icons/react';

export const ProfilePage: React.FC = () => {
  const { watchlist, history, openVideo } = usePlayer();
  const { user, subscription, isVip, refreshSubscription, logout: authLogout } = useAuth();

  const [watchlistVideos, setWatchlistVideos] = useState<VideoItem[]>([]);
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Load details / skeletons for watchlist videos
  useEffect(() => {
    let isMounted = true;
    async function loadWatchlistDetails() {
      if (!watchlist || watchlist.length === 0) {
        setWatchlistVideos([]);
        return;
      }
      setIsLoadingWatchlist(true);
      const items: VideoItem[] = [];
      
      // Load all items in parallel for speed
      const loadedItems = await Promise.all(watchlist.map(async (item) => {
        try {
          if (/^\d{6,}$/.test(String(item.id))) {
            // Popcorn ID - Re-resolve metadata for auto-repair of broken images
            const detail = await getPopcornDetail(String(item.id));
            if (detail) {
              return {
                ...item,
                title: detail.title,
                thumbnail: detail.poster || detail.cover || item.thumbnail,
                duration: detail.badgeTag || item.duration
              };
            }
          } else {
            // YouTube / Generic ID
            const details = await yt.getVideo(item.id);
            return normalizeItem(details);
          }
        } catch {
          return item;
        }
        return item;
      }));

      if (isMounted) {
        setWatchlistVideos(loadedItems.filter(Boolean) as VideoItem[]);
        setIsLoadingWatchlist(false);
      }
    }
    loadWatchlistDetails();
    return () => {
      isMounted = false;
    };
  }, [watchlist]);

  const handleLogout = async () => {
    await authLogout();
  };

  const SUBSCRIPTION_PLANS = {
    weekly: { id: 'weekly', name: 'Weekly Pass', amount: 950, termDays: 7 },
    vip_monthly: { id: 'vip_monthly', name: 'VIP Monthly', amount: 3500, termDays: 30 }
  };

  const handleSubscribe = (planId: 'weekly' | 'vip_monthly') => {
    if (!user) {
      setPaymentError('Please sign in or create an account to activate your subscription.');
      setShowAuthModal(true);
      return;
    }

    setPaymentError(null);
    setPaymentSuccessMessage(null);

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) return;

    const payWindow = window as any;
    if (typeof payWindow.payWithPaystack === 'function') {
      payWindow.payWithPaystack(
        user.email || 'customer@email.com',
        plan.amount * 100,
        async (response: any) => {
          try {
            const now = new Date();
            const expiry = new Date(now.getTime() + plan.termDays * 24 * 60 * 60 * 1000);
            const userKey = (user.id || user.email).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const reference = response?.reference || ('MH_' + Date.now());

            const sub = {
              userId: user.id || user.email,
              userEmail: user.email,
              planId: plan.id,
              planName: plan.name,
              amount: plan.amount * 100,
              reference,
              status: 'active',
              entitlement: true,
              startDate: now.toISOString(),
              expiryDate: expiry.toISOString(),
              daysLeft: plan.termDays,
              updatedAt: now.toISOString()
            };

            await fetch(`https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/userData/subscription_${userKey}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sub)
            });

            await refreshSubscription();
            setPaymentSuccessMessage(`🎉 Success! Your ${plan.name} is now active.`);
          } catch (err: any) {
            setPaymentError(err.message || 'Subscription activation failed.');
          }
        }
      );
    } else {
      setPaymentError('Paystack SDK not loaded.');
    }
  };

  const totalWatchedHours = Math.round((history.reduce((acc, curr) => acc + (curr.lengthSeconds || 180), 0) / 3600) * 10) / 10;

  return (
    <div className="min-h-screen flex flex-col justify-between pb-32 select-none bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full flex justify-between items-center px-4 py-3 glass-nav transition-all duration-300">
        <div className="flex items-center space-x-2">
          <User size={26} weight="bold" className="text-butterYellow" />
          <h1 className="text-xl font-bold tracking-tight text-white">
            Profile & Account
          </h1>
        </div>
        <button
          onClick={() => (user ? handleLogout() : setShowAuthModal(true))}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 flex items-center space-x-1.5 cursor-pointer transition-colors"
        >
          {user ? (
            <>
              <SignOut size={14} weight="bold" />
              <span>Log out</span>
            </>
          ) : (
            <>
              <SignIn size={14} weight="bold" className="text-butterYellow" />
              <span>Sign in</span>
            </>
          )}
        </button>
      </header>

      {/* Main Profile Content */}
      <main className="flex-grow p-4 space-y-6">
        {/* User Card */}
        <div className="p-4 rounded-2xl border border-white/5 bg-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80"
              alt="User profile"
              className="w-16 h-16 rounded-full object-cover ring-2 ring-butterYellow"
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                {user ? (user.name || user.email.split('@')[0]) : 'Cinema Enthusiast'}
              </h2>
              <p className="text-xs text-gray-400 truncate max-w-[180px]">
                {user ? user.email : 'Guest (Sign in for MadHouse VIP)'}
              </p>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-butterYellow/20 text-butterYellow border border-butterYellow/40">
                {isVip && subscription
                  ? `MadHouse VIP (${subscription.planName} • ${subscription.daysLeft}d left)`
                  : user
                  ? 'MadHouse Member'
                  : 'Free Explorer'}
              </span>
            </div>
          </div>

          {!user && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-2 rounded-xl bg-butterYellow text-black font-bold text-xs shadow hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-white/5 bg-white/5 text-center">
            <div className="text-lg font-bold text-white">{watchlist.length}</div>
            <div className="text-[11px] text-gray-400">Watchlist</div>
          </div>
          <div className="p-3 rounded-xl border border-white/5 bg-white/5 text-center">
            <div className="text-lg font-bold text-white">0</div>
            <div className="text-[11px] text-gray-400">Downloaded</div>
          </div>
          <div className="p-3 rounded-xl border border-white/5 bg-white/5 text-center">
            <div className="text-lg font-bold text-white">{totalWatchedHours}h</div>
            <div className="text-[11px] text-gray-400">Watched</div>
          </div>
        </div>

        {/* Watchlist / Saved Videos Carousel with Skeleton Loader */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Saved Watchlist ({watchlist.length})
            </h3>
          </div>

          {isLoadingWatchlist ? (
            <div className="flex space-x-3 overflow-x-auto no-scrollbar py-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="w-48 flex-shrink-0 animate-pulse flex flex-col space-y-2"
                >
                  <div className="w-full aspect-video bg-gray-200 rounded-lg" />
                  <div className="h-3 bg-gray-200 rounded w-4/5" />
                  <div className="h-2.5 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : watchlistVideos.length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center border border-dashed border-white/10 rounded-2xl">
              No saved videos yet. Tap "Save" on any video to add it here.
            </div>
          ) : (
            <div className="flex space-x-3 overflow-x-auto no-scrollbar py-2">
              {watchlistVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => openVideo(video.id)}
                  className="w-48 flex-shrink-0 cursor-pointer group select-none flex flex-col"
                >
                  <div className="relative w-full aspect-video bg-white/5 rounded-lg overflow-hidden border border-white/5">
                    <ImageWithFallback
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
                      {video.duration || '2:30'}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white mt-1.5 line-clamp-1 leading-snug">
                    {video.title}
                  </h4>
                  <p className="text-[11px] text-gray-400">{video.channelName}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vertical Price Bar Chart Table */}
        <div className="space-y-3 pt-3 -mx-4 overflow-hidden">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Membership Plans
            </h3>
            <span className="text-[10px] font-bold text-butterYellow uppercase tracking-wider flex items-center space-x-1">
              <Sparkle size={12} weight="fill" className="text-butterYellow" />
              <span>Instant VIP Membership</span>
            </span>
          </div>

          {/* Payment Feedback Alerts */}
          {paymentSuccessMessage && (
            <div className="mx-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between animate-fadeIn">
              <div className="flex items-center space-x-2">
                <CheckCircle size={18} weight="fill" className="flex-shrink-0" />
                <span>{paymentSuccessMessage}</span>
              </div>
              <button
                onClick={() => setPaymentSuccessMessage(null)}
                className="text-gray-400 hover:text-white ml-2 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {paymentError && (
            <div className="mx-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center justify-between animate-fadeIn">
              <div className="flex items-center space-x-2">
                <WarningCircle size={18} weight="fill" className="flex-shrink-0" />
                <span>{paymentError}</span>
              </div>
              <button
                onClick={() => setPaymentError(null)}
                className="text-gray-400 hover:text-white ml-2 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-end justify-center w-full gap-0 select-none pt-6 pb-0">
            {/* Card 1: 950 Plan (60vh) */}
            <div className="flex-1 h-[60vh] rounded-none border-t border-b-0 border-l-0 border-r-0 border-white/20 bg-neutral-900/90 p-2.5 sm:p-4 flex flex-col justify-between text-center select-none shadow-xl">
              <div className="flex flex-col items-center space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Weekly</span>
                <div className="text-2xl font-black text-white tracking-tight">#950</div>
                <span className="text-[9px] text-gray-400">7 Days Access</span>
              </div>

              <div className="flex flex-col space-y-2 my-auto text-[10.5px] text-gray-300 font-medium py-2">
                <div className="border-b border-white/10 pb-1">Unlimited Downloads</div>
                <div className="border-b border-white/10 pb-1">YouTube & Streaming</div>
                <div className="border-b border-white/10 pb-1">HD Player</div>
                <div className="pt-0.5 text-gray-400 text-[10px]">One Account</div>
              </div>

              <button
                onClick={() => handleSubscribe('weekly')}
                className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all mb-2 ${
                  isVip && subscription?.planId === 'weekly'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {isVip && subscription?.planId === 'weekly' ? 'Active Plan' : 'Select'}
              </button>
            </div>

            {/* Card 2: 3500 Plan (65vh - Highlighted Hero Card) */}
            <div className="flex-1 h-[65vh] bg-[#E5C058] text-black border-t-2 border-l-2 border-r-2 border-b-0 border-[#E5C058] rounded-t-2xl rounded-b-none p-2.5 sm:p-4 flex flex-col justify-between text-center select-none shadow-[0_0_35px_rgba(229,192,88,0.35)] z-10 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-[#E5C058] border border-[#E5C058] text-[9px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
                BEST VALUE
              </div>

              <div className="flex flex-col items-center space-y-0.5 pt-2">
                <span className="text-[10px] font-extrabold uppercase tracking-tight text-black/70">Multi Account</span>
                <div className="text-3xl font-black text-black tracking-tight">#3500</div>
                <span className="text-[9px] font-bold text-black/60">30 Days VIP</span>
              </div>

              <div className="flex flex-col space-y-2 my-auto text-[10.5px] text-black font-bold py-2">
                <div className="border-b border-black/15 pb-1">Multi Account</div>
                <div className="border-b border-black/15 pb-1">Unlimited Downloads</div>
                <div className="border-b border-black/15 pb-1">Streaming</div>
                <div className="border-b border-black/15 pb-1">YT Premium</div>
                <div className="pt-0.5 text-black/80 text-[10px]">Priority Speeds</div>
              </div>

              <button
                onClick={() => handleSubscribe('vip_monthly')}
                className={`w-full py-3 rounded-xl font-black text-xs cursor-pointer active:scale-95 transition-all shadow-lg mb-2 ${
                  isVip && subscription?.planId === 'vip_monthly'
                    ? 'bg-black/90 text-butterYellow border border-black'
                    : 'bg-black text-[#E5C058] hover:bg-neutral-900'
                }`}
              >
                {isVip && subscription?.planId === 'vip_monthly' ? 'Active VIP' : 'Get VIP'}
              </button>
            </div>

            {/* Card 3: Smart Plan (60vh) - Replaces 2000 with 'Soon' */}
            <div className="flex-1 h-[60vh] rounded-none border-t border-b-0 border-l-0 border-r-0 border-white/20 bg-neutral-900/90 p-2.5 sm:p-4 flex flex-col justify-between text-center select-none shadow-xl">
              <div className="flex flex-col items-center space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Smart Plan</span>
                <div className="text-2xl font-black text-butterYellow/70 tracking-tight">Soon</div>
                <span className="text-[9px] text-gray-400">Coming Soon</span>
              </div>

              <div className="flex flex-col space-y-2 my-auto text-[10.5px] text-gray-300 font-medium py-2">
                <div className="border-b border-white/10 pb-1">HD & Smart TV Usage</div>
                <div className="border-b border-white/10 pb-1">Streaming & Cast</div>
                <div className="border-b border-white/10 pb-1">Multi-Room Audio</div>
                <div className="pt-0.5 text-gray-400 text-[10px]">4K Ultra HDR</div>
              </div>

              <button
                disabled
                className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-xs cursor-not-allowed mb-2 select-none"
              >
                Soon
              </button>
            </div>
          </div>
        </div>

        {/* Settings and Preferences List */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
            Preferences & Settings
          </h3>

          <div className="rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5 bg-white/5">
            {/* Account / VIP Membership Trigger */}
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center space-x-3">
                <User size={20} className="text-butterYellow" weight="bold" />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {user ? 'MadHouse Account' : 'Sign In / Register'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {user ? user.email : 'Sign in or create account'}
                  </div>
                </div>
              </div>
              <CaretRight size={16} className="text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors cursor-pointer text-left">
              <div className="flex items-center space-x-3">
                <DownloadSimple size={20} className="text-butterYellow" weight="bold" />
                <div>
                  <div className="text-sm font-semibold text-white">Offline Downloads</div>
                  <div className="text-xs text-gray-400">Manage downloaded trailers & storage</div>
                </div>
              </div>
              <CaretRight size={16} className="text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors cursor-pointer text-left">
              <div className="flex items-center space-x-3">
                <BookmarkSimple size={20} className="text-butterYellow" weight="bold" />
                <div>
                  <div className="text-sm font-semibold text-white">My Saved Lists</div>
                  <div className="text-xs text-gray-400">Favorites & custom collections</div>
                </div>
              </div>
              <CaretRight size={16} className="text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors cursor-pointer text-left">
              <div className="flex items-center space-x-3">
                <Sliders size={20} className="text-butterYellow" weight="bold" />
                <div>
                  <div className="text-sm font-semibold text-white">Streaming Quality</div>
                  <div className="text-xs text-gray-400">Default to 1080p FHD</div>
                </div>
              </div>
              <CaretRight size={16} className="text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors cursor-pointer text-left">
              <div className="flex items-center space-x-3">
                <ShieldCheck size={20} className="text-butterYellow" weight="bold" />
                <div>
                  <div className="text-sm font-semibold text-white">Privacy & Permissions</div>
                  <div className="text-xs text-gray-400">Session cookies & streaming</div>
                </div>
              </div>
              <CaretRight size={16} className="text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors cursor-pointer text-left">
              <div className="flex items-center space-x-3">
                <Gear size={20} className="text-butterYellow" weight="bold" />
                <div>
                  <div className="text-sm font-semibold text-white">App Settings</div>
                  <div className="text-xs text-gray-400">Liquid glass effects, theme</div>
                </div>
              </div>
              <CaretRight size={16} className="text-gray-400" />
            </button>
          </div>
        </div>
      </main>

      {/* Auth Modal Popup */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />
    </div>
  );
};
