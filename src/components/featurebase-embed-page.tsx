type FeaturebaseEmbedPageProps = {
  title: string;
  description: string;
  href?: string;
};

export function FeaturebaseEmbedPage({
  title,
  description,
  href,
}: FeaturebaseEmbedPageProps) {
  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open in Featurebase
        </a>
      ) : null}
    </section>
  );
}
