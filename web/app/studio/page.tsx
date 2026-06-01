import { Suspense } from "react";
import { StudioClient } from "./StudioClient";

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
          Loading studio…
        </div>
      }
    >
      <StudioClient />
    </Suspense>
  );
}
