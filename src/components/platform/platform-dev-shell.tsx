import Link from "next/link";
import { getDeveloperNavigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function PlatformDevShell({
  children,
  activeHref,
}: {
  children: React.ReactNode;
  activeHref?: string;
}) {
  const tools = getDeveloperNavigationItems().filter((tool) =>
    ["/dev", "/dev/tenants", "/dev/users", "/dev/bootstrap"].includes(tool.url)
  );

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-64 shrink-0 border-r border-border pr-4 lg:block">
          <div className="sticky top-6 flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Platform
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                Developer
              </h1>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Platform developer">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const active = activeHref === tool.url;

                return (
                  <Link
                    key={tool.url}
                    href={tool.url}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {Icon ? <Icon className="size-4" /> : null}
                    <span>{tool.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
