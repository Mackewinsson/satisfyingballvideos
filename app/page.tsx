import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
          Satisfying physics
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Custom bouncing-ring animations
        </h1>
        <p className="mt-6 text-lg text-zinc-400">
          Pick your colors, watermark, and length. Preview free in the browser.
          Pay once to download a transparent GIF ready for social.
        </p>
        <p className="mt-4 text-2xl font-semibold text-white">
          $4.99 <span className="text-base font-normal text-zinc-500">per GIF</span>
        </p>
        <Link
          href="/studio"
          className="mt-10 inline-block rounded-xl bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500"
        >
          Open studio
        </Link>
        <ul className="mt-16 grid w-full gap-4 text-left text-sm text-zinc-400 sm:grid-cols-3">
          <li className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <strong className="text-white">Customize</strong>
            <br />
            Watermark, hue, 30s or 60s
          </li>
          <li className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <strong className="text-white">Preview</strong>
            <br />
            Live canvas, no signup
          </li>
          <li className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <strong className="text-white">Download</strong>
            <br />
            Transparent GIF after unlock
          </li>
        </ul>
      </div>
    </main>
  );
}
