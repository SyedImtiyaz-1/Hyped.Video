/** A plain, readable page for the Terms, Privacy and Refund policies. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: React.ReactNode; sections: { heading: string; body: React.ReactNode }[] }) {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-16 md:px-8 md:py-24">
      <h1 className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-gray-900">Last updated {updated}</p>
      <div className="mt-8 text-[15px] leading-7 text-gray-1000 [&_a]:underline [&_a]:underline-offset-4">{intro}</div>
      <div className="mt-10 space-y-10">
        {sections.map(({ heading, body }, i) => (
          <section key={heading}>
            <h2 className="text-lg font-semibold tracking-tight">
              {i + 1}. {heading}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-7 text-gray-900 [&_a]:text-gray-1000 [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-gray-1000">{body}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
