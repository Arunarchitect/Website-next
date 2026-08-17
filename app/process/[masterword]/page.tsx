// process/[masterword]/page.tsx

import ProcessWorkflowEditor from "@/app/process/ProcessWorkflowEditor";

export default async function ProcessGroupPage({
  params,
}: {
  params: Promise<{ masterword: string }>;
}) {
  const { masterword } = await params;
  return <ProcessWorkflowEditor masterword={masterword} />;
}