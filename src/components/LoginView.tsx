import React, { useState, useEffect } from 'react';

interface LoginViewProps {
  onLoginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  onGuestContinue?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginWithGoogle,
  onGuestContinue,
}) => {
  const [loading, setLoading] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Mobile navigation step: 'about' (Screen 1) or 'login' (Screen 2)
  const [mobileStep, setMobileStep] = useState<'about' | 'login'>('about');

  // PWA Install prompt handling
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (checkStandalone) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        'To install Luminous Finance as an app on your phone:\n\n' +
          '• Android (Chrome): Tap browser menu (⋮) -> "Install App" or "Add to Home screen"\n' +
          '• iPhone (iOS Safari): Tap Share button (⎋) -> "Add to Home Screen"'
      );
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      await onLoginWithGoogle(staySignedIn);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err?.code === 'auth/unauthorized-domain') {
        setErrorMsg(
          `Domain "${window.location.hostname}" is not authorized in your Firebase Project. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains and add "${window.location.hostname}".`
        );
      } else {
        setErrorMsg(err?.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#041627] via-[#003857] to-[#006397] text-white flex flex-col justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden selection:bg-[#5cb8fd] selection:text-[#00476e]">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00a656]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#5cb8fd]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center z-10 py-2">
        <div className="flex items-center gap-3">
          <img
            src="/icon-192.png"
            alt="Luminous App Icon"
            className="w-10 h-10 rounded-2xl shadow-lg border border-white/20 object-cover"
          />
          <div>
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>Luminous Finance</span>
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#92ccff] tracking-wider block">
              Smart Pacing Engine
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition-all active:scale-95 cursor-pointer text-[#92ccff]"
              title="Install app on mobile or desktop"
            >
              <span className="material-symbols-outlined text-[16px]">install_mobile</span>
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          <button
            onClick={() => {
              if (mobileStep === 'about') {
                setMobileStep('login');
              } else {
                handleGoogleLogin();
              }
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-white text-[#041627] hover:bg-[#f0f4f8] rounded-xl text-xs font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In</span>
          </button>
        </div>
      </header>

      {/* Mobile Step Navigation Tabs (Visible on mobile/tablet screens lg:hidden) */}
      <div className="lg:hidden w-full max-w-md mx-auto z-10 my-3 flex items-center justify-center p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
        <button
          onClick={() => setMobileStep('about')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
            mobileStep === 'about'
              ? 'bg-white text-[#041627] shadow-md'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span>About App</span>
        </button>

        <button
          onClick={() => setMobileStep('login')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
            mobileStep === 'login'
              ? 'bg-white text-[#041627] shadow-md'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">login</span>
          <span>Sign In</span>
        </button>
      </div>

      {/* Main Content Container */}
      <main className="w-full max-w-7xl mx-auto my-auto py-4 sm:py-8 z-10">
        {/* DESKTOP LAYOUT (lg:grid): Displays side-by-side */}
        {/* MOBILE LAYOUT (lg:hidden): Shows Screen 1 or Screen 2 based on mobileStep */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          
          {/* SCREEN 1 / LEFT COLUMN: About the App */}
          <div
            className={`lg:col-span-7 flex flex-col gap-5 text-center lg:text-left ${
              mobileStep === 'about' ? 'block' : 'hidden lg:flex'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-[#92ccff] w-max mx-auto lg:mx-0 backdrop-blur-md">
              <span className="material-symbols-outlined text-[16px] text-[#00a656]" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
              <span>Powered by Google Gemini 2.5 AI</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Master your money with <span className="bg-gradient-to-r from-[#92ccff] via-white to-[#00a656] bg-clip-text text-transparent">AI Financial Pacing</span>
            </h1>

            <p className="text-xs sm:text-base text-white/80 max-w-2xl font-medium leading-relaxed mx-auto lg:mx-0">
              Luminous Finance calculates your real-time daily spending allowance until payday, scans receipt photos instantly with Gemini AI, and syncs your budget across all your devices.
            </p>

            {/* Feature Bullets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-1 max-w-xl mx-auto lg:mx-0">
              <div className="flex items-start gap-3 text-left p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <span className="material-symbols-outlined text-[#00a656] text-[20px] shrink-0 mt-0.5">document_scanner</span>
                <div>
                  <h4 className="text-xs font-bold text-white">AI Receipt Scanning</h4>
                  <p className="text-[11px] text-white/70">Snap receipt photos to auto-extract merchant, total, date & category.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <span className="material-symbols-outlined text-[#92ccff] text-[20px] shrink-0 mt-0.5">speed</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Dynamic Pacing Engine</h4>
                  <p className="text-[11px] text-white/70">Calculates safe daily burn rate based on your payday anchor date.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <span className="material-symbols-outlined text-[#5cb8fd] text-[20px] shrink-0 mt-0.5">cloud_sync</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Multi-Device Sync</h4>
                  <p className="text-[11px] text-white/70">Instant real-time synchronization backed by Google Cloud & Firestore.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <span className="material-symbols-outlined text-[#facc15] text-[20px] shrink-0 mt-0.5">install_mobile</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Installable Mobile PWA</h4>
                  <p className="text-[11px] text-white/70">Run as a standalone native app on Android & iOS without app store fees.</p>
                </div>
              </div>
            </div>

            {/* Mobile View CTA: Proceed to Login Page */}
            <div className="lg:hidden flex flex-col gap-3 mt-4 w-full max-w-md mx-auto">
              <button
                onClick={() => setMobileStep('login')}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#00a656] to-[#008243] hover:from-[#008243] hover:to-[#006397] text-white font-extrabold text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>

              {!isInstalled && (
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-[#92ccff] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Install App on Phone</span>
                </button>
              )}
            </div>
          </div>

          {/* SCREEN 2 / RIGHT COLUMN: Sign In Page */}
          <div
            className={`lg:col-span-5 w-full max-w-md mx-auto ${
              mobileStep === 'login' ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col gap-5 text-center relative">
              
              {/* Back to About button on mobile screen 2 */}
              <button
                onClick={() => setMobileStep('about')}
                className="lg:hidden absolute top-4 left-4 p-1.5 rounded-full bg-white/10 text-white/80 hover:text-white flex items-center justify-center"
                title="Back to About App"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>

              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="w-16 h-16 rounded-2xl bg-white/10 p-2 border border-white/20 shadow-inner flex items-center justify-center">
                  <img src="/icon-192.png" alt="Luminous Icon" className="w-full h-full object-cover rounded-xl" />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
                  Sign In to Luminous
                </h2>
                <p className="text-xs text-white/70">
                  Sync your financial pacing, budgets & receipts seamlessly.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-[#e11d48]/20 border border-[#e11d48]/40 rounded-xl text-xs text-red-200 text-left flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-red-400 shrink-0">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Primary Google Login Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3.5 px-5 bg-white hover:bg-[#f0f4f8] text-[#041627] font-extrabold text-sm sm:text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#006397] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>{loading ? 'Authenticating...' : 'Continue with Gmail / Google'}</span>
              </button>

              {/* Stay Signed In Option Checkbox */}
              <label className="flex items-center justify-center gap-2.5 text-xs text-white/80 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={staySignedIn}
                  onChange={(e) => setStaySignedIn(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 text-[#006397] focus:ring-[#006397] bg-white/20 accent-[#006397] cursor-pointer"
                />
                <span className="font-semibold">Stay signed in on this device</span>
              </label>

              {/* Download / Install App option on the login page */}
              {!isInstalled && (
                <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-[#92ccff] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">install_mobile</span>
                    <span>Download / Install Standalone App</span>
                  </button>
                </div>
              )}

              {onGuestContinue && (
                <button
                  onClick={onGuestContinue}
                  className="text-xs text-white/60 hover:text-white underline font-semibold transition-all pt-1"
                >
                  Try Demo Preview as Guest
                </button>
              )}

              <div className="border-t border-white/10 pt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/60">
                <span className="material-symbols-outlined text-[14px] text-[#00a656]">lock</span>
                <span>256-bit encrypted • Private & Secure</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto z-10 text-center text-xs text-white/50 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/10">
        <span>&copy; {new Date().getFullYear()} Luminous Finance • Smart Pacing & AI Expense Manager</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-[#92ccff]">
            <span className="material-symbols-outlined text-[14px]">shield</span> Firebase Auth Verified
          </span>
        </div>
      </footer>
    </div>
  );
};
