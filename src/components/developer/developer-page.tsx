import Link from "next/link";
import { getDeveloperNavigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type DeveloperPageProps = {
  title: string;
  description: string;
  activeHref: string;
};

export function DeveloperPage({
  title,
  description,
  activeHref,
}: DeveloperPageProps) {
  const tools = getDeveloperNavigationItems();
  const activeTool = tools.find((tool) => tool.url === activeHref);
  const Icon = activeTool?.icon;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="flex flex-col gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {Icon ? <Icon className="size-5" /> : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Developer
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Placeholder</p>
          <p className="text-sm text-muted-foreground">
            This platform-level tool is reserved for Developer users. The route,
            guard, and navigation entry are in place so implementation can be
            added without changing the sidebar architecture.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => {
          const ToolIcon = tool.icon;
          const active = tool.url === activeHref;

          return (
            <Link
              key={tool.url}
              href={tool.url}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {ToolIcon ? <ToolIcon className="mt-0.5 size-4 shrink-0" /> : null}
              <span className="font-medium">{tool.title}</span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
