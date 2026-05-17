import Link from "next/link";
import { getDeveloperNavigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type PlatformDevPageProps = {
  title: string;
  description: string;
  activeHref: string;
  children?: React.ReactNode;
};

export function PlatformDevPage({
  title,
  description,
  activeHref,
  children,
}: PlatformDevPageProps) {
  const tools = getDeveloperNavigationItems();
  const activeTool = tools.find((tool) => tool.url === activeHref);
  const Icon = activeTool?.icon;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="rounded-lg border border-amber-500/20 bg-card/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
              {Icon ? <Icon className="size-5" /> : null}
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Platform Developer
                </p>
                <span className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                  Dev area
                </span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {children}

      <section className="grid gap-2 sm:grid-cols-2 lg:hidden">
        {tools.map((tool) => {
          const ToolIcon = tool.icon;
          const active = tool.url === activeHref;

          return (
            <Link
              key={tool.url}
              href={tool.url}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                active
                  ? "border-cyan-500/30 bg-cyan-500/10 text-foreground"
                  : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {ToolIcon ? (
                <ToolIcon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-cyan-700 dark:text-cyan-300" : undefined
                  )}
                />
              ) : null}
              <span className="font-medium">{tool.title}</span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
