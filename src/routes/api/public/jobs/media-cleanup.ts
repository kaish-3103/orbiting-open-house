import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';
export const Route = createFileRoute('/api/public/jobs/media-cleanup')({ server: { handlers: { POST: async ({ request }) => {
  const failure = await authenticateCronRequest(request); if (failure) return failure;
  const input = z.object({ kind: z.literal('media-cleanup') }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response('Invalid request', { status: 400 });
  const { cleanupMedia } = await import('@/lib/media-cleanup.server');
  const result = await cleanupMedia();
  return Response.json(result, { status: result.ok ? 200 : 503 });
} } } });