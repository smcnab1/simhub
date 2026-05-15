type NotAllowedProps = {
  title?: string;
  message?: string;
};

export function NotAllowed({
  title = "Not allowed",
  message = "Your current SimHub role does not allow access to this area.",
}: NotAllowedProps) {
  return (
    <section className="rounded-lg border border-border bg-primary/10 p-5 text-foreground">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
        Access restricted
      </p>
      <h1 className="mt-2 text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm">{message}</p>
    </section>
  );
}
