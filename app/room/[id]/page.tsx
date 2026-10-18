import SpatialShell from "@/features/shell/SpatialShell";

export function generateMetadata({ params }: { params: { id: string } }) {
  return { title: "Live work room · Wippo" };
}

export default function Page() {
  return <SpatialShell />;
}
