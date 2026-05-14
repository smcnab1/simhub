import { NotAllowed } from "@/components/not-allowed";
import { getDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getDashboardAccess({ requiredRole: "admin" });

  if (!access.ok) {
    return (
      <NotAllowed
        title="Admin access required"
        message="Only Admin users can manage facility settings, users, rooms, campuses, room types, and request form configuration."
      />
    );
  }

  return children;
}
