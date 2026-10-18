import SpatialShell from "@/features/shell/SpatialShell";

export function generateMetadata({ params }: { params: { id: string } }) {
  return { title: "Project journey · Wippo" };
}

export default function Page() {
  return <SpatialShell />;
}
