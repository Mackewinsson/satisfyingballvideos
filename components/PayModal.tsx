"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void;
  loading?: boolean;
  error?: string | null;
};

export function PayModal({ open, onClose, onUnlock, loading, error }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-labelledby="pay-title"
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
      >
        <h2 id="pay-title" className="text-xl font-semibold text-white">
          Unlock your Export
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          One-time payment for your custom animation. You will be redirected to Lemon Squeezy to complete the purchase securely.
        </p>
        <p className="mt-4 text-2xl font-bold text-white">
          $4.99{" "}
          <span className="text-sm font-normal text-zinc-500">per export</span>
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-zinc-600 py-2.5 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onUnlock}
            disabled={loading}
            className="flex-1 rounded-lg bg-violet-600 py-2.5 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "Redirecting…" : "Continue to Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
