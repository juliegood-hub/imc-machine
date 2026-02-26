#!/usr/bin/env node
// Polls Supabase for pending video transcode jobs and generates platform variants.
// Run locally: node worker/video-variant-worker.js
// Requires ffmpeg installed and available in PATH.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const POLL_INTERVAL = Number(process.env.VIDEO_WORKER_POLL_MS || 30000);
const BATCH_SIZE = Number(process.env.VIDEO_WORKER_BATCH || 2);
const BUCKET = process.env.VIDEO_WORKER_BUCKET || 'media';

const VARIANT_SPECS = {
  vertical_9_16: { width: 1080, height: 1920, suffix: 'vertical-1080x1920.mp4' },
  square_1_1: { width: 1080, height: 1080, suffix: 'square-1080x1080.mp4' },
  landscape_16_9: { width: 1920, height: 1080, suffix: 'landscape-1920x1080.mp4' },
};

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'pipe', ...opts });
    let stderr = '';
    child.stderr.on('data', (buf) => { stderr += buf.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ code, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function hasFfmpeg() {
  try {
    await run('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(ab));
}

async function transcodeVariant(inputPath, outputPath, spec) {
  const vf = `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease,pad=${spec.width}:${spec.height}:(ow-iw)/2:(oh-ih)/2:black`;
  const args = [
    '-y',
    '-i', inputPath,
    '-vf', vf,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ];
  await run('ffmpeg', args);
}

async function uploadVariant(jobId, key, localPath, spec) {
  const storagePath = `distribution/videos/variants/${jobId}/${spec.suffix}`;
  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, {
    contentType: 'video/mp4',
    upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${key}: ${error.message}`);
  return {
    path: storagePath,
    url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`,
    width: spec.width,
    height: spec.height,
    contentType: 'video/mp4',
  };
}

async function processJob(job) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `imc-video-${job.id}-`));
  const inputPath = path.join(tmpDir, 'source.mp4');
  const outputs = {};
  let overallError = null;

  try {
    await supabase.from('video_transcode_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString(), error: null })
      .eq('id', job.id);

    await downloadFile(job.source_url, inputPath);

    const targets = Array.isArray(job.targets) && job.targets.length
      ? job.targets
      : Object.keys(VARIANT_SPECS);

    for (const key of targets) {
      const spec = VARIANT_SPECS[key];
      if (!spec) continue;
      const outputPath = path.join(tmpDir, `${key}.mp4`);
      try {
        await transcodeVariant(inputPath, outputPath, spec);
        const uploaded = await uploadVariant(job.id, key, outputPath, spec);
        outputs[key] = { success: true, ...uploaded };
      } catch (err) {
        outputs[key] = { success: false, error: err.message };
      }
    }

    const anySuccess = Object.values(outputs).some((o) => o && o.success);
    const failedKeys = Object.entries(outputs).filter(([, v]) => v && !v.success).map(([k]) => k);
    if (!anySuccess) {
      overallError = 'All variant transcodes failed';
    } else if (failedKeys.length > 0) {
      overallError = `Some variants failed: ${failedKeys.join(', ')}`;
    }

    await supabase.from('video_transcode_jobs')
      .update({
        status: anySuccess ? 'completed' : 'failed',
        outputs,
        error: overallError,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  } catch (err) {
    await supabase.from('video_transcode_jobs')
      .update({
        status: 'failed',
        outputs,
        error: err.message,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

async function processPendingJobs() {
  const ffmpegReady = await hasFfmpeg();
  if (!ffmpegReady) {
    console.error('[video-worker] ffmpeg not found in PATH. Install ffmpeg to process jobs.');
    return;
  }

  const { data: pending, error } = await supabase
    .from('video_transcode_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[video-worker] Query error:', error.message);
    return;
  }
  if (!pending?.length) return;

  for (const job of pending) {
    console.log(`[video-worker] Processing job ${job.id}...`);
    await processJob(job);
    console.log(`[video-worker] Finished job ${job.id}`);
  }
}

async function main() {
  console.log('[video-worker] started');
  console.log(`[video-worker] polling every ${POLL_INTERVAL / 1000}s`);
  while (true) {
    try {
      await processPendingJobs();
    } catch (err) {
      console.error('[video-worker] error:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

main();
