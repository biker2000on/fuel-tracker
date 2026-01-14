"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Offline icon */}
        <div className="mb-6">
          <svg
            className="w-24 h-24 mx-auto text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-.707-7.071L3 3m8.707 8.707L3 3"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-white mb-2">
          You&apos;re offline
        </h1>
        <p className="text-slate-400 mb-6">
          Please check your internet connection and try again.
        </p>

        {/* Retry button */}
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
