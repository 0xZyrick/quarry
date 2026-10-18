import SpatialShell from "@/features/shell/SpatialShell";

export function generateMetadata({ params }: { params: { handle: string } }) {
  return { title: `@${decodeURIComponent(params.handle)} · Wippo` };
}

export default function Page() {
  return <SpatialShell />;
}
