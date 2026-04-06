import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-av-orange/10 border border-av-orange/30 flex items-center justify-center">
          <span className="text-2xl">🔍</span>
        </div>
        <h2 className="text-lg font-bold text-av-white mb-2">
          Page Not Found
        </h2>
        <p className="text-sm text-av-hint mb-6 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex px-5 py-2.5 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
