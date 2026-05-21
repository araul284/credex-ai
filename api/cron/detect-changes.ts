/**
 * api/detect-changes.ts  (Vercel API Route)
 *
 * Endpoint: POST /api/detect-changes
 *
 * Can be triggered:
 *   1. Manually: curl -X POST https://yourapp.vercel.app/api/detect-changes \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *   2. Via Vercel Cron (see vercel.json):
 *        { "crons": [{ "path": "/api/detect-changes", "schedule": "0 9 * * 1" }] }
 *
 * Security: requires CRON_SECRET env var header match (or Vercel's x-vercel-signature).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runPricingChangeDetection } from '../_lib/pricingDetector.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST (Vercel Cron sends GET, so allow both)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: check CRON_SECRET (set in Vercel env vars)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.authorization;
    // Vercel Cron automatically sends the secret; manual callers must provide it
    const provided = authHeader?.replace('Bearer ', '') ?? req.query.secret;
    if (provided !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const result = await runPricingChangeDetection();
    return res.status(200).json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[detect-changes] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}