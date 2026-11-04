export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-3xl" aria-hidden>
          🏠
        </p>
        <p className="text-2xl font-bold">My House</p>
        <p className="text-sm text-zinc-500">Las finanzas del hogar, en orden.</p>
      </div>
      {children}
    </main>
  );
}
