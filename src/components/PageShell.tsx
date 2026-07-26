import AppHeader from "./AppHeader";

export default function PageShell({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader title={title} badge={badge} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f2f5f2] px-8 py-6">
        <div className="mx-auto max-w-[980px]">{children}</div>
      </div>
    </>
  );
}
