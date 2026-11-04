import { AdminLayoutWrapper } from "@/components/admin/admin-layout-wrapper";

export const metadata = {
  title: "AWTMods Admin Console",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
