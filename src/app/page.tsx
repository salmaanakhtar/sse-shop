const facts = [
  { term: "Currency", detail: "Prices in UAE dirhams, stored as whole fils." },
  { term: "Tax", detail: "5% VAT is already inside every displayed price." },
  { term: "Delivery", detail: "One flat rate, free above a threshold." },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-14 px-6 py-24">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">sse-shop</p>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          The store is being built.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
          Catalog, cart, and checkout are next. Each one ships with tests before it takes an order.
        </p>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.term} className="bg-surface p-6">
            <dt className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
              {fact.term}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed">{fact.detail}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
