'use client';

import { useParams } from 'next/navigation';
import { ProblemsList } from '@/components/ProblemsList';

export default function ProblemsPage() {
  const params = useParams();
  const siteId = params.id as string;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Problems</h1>
        <p className="text-muted-foreground">
          Prioritized issues affecting your site. Fix the highest impact problems first.
        </p>
      </div>

      <ProblemsList siteId={siteId} />
    </div>
  );
}
