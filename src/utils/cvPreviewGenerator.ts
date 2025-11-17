import { supabase } from '@/integrations/supabase/client';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - import worker file as URL string for Vite
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;

/**
 * Generate high-DPI WebP page previews for a PDF and upload to private storage.
 *
 * Storage layout (PRIVATE bucket job-applications):
 *  cv-previews/{userId}/{baseId}/page-{n}@2x.webp
 *  cv-previews/{userId}/{baseId}/manifest.json
 *
 * @param file PDF file blob (freshly uploaded)
 * @param userId current user id
 * @param pdfStoragePath the storage path of original PDF: "{userId}/{timestamp-random}.pdf"
 * @returns array of uploaded preview storage paths
 */
export async function generateAndUploadCvPreviews(
  file: File,
  userId: string,
  pdfStoragePath: string
): Promise<{ paths: string[]; error?: Error }> {
  try {
    if (!file || file.type !== 'application/pdf') {
      return { paths: [] };
    }

    const baseId = pdfStoragePath.split('/').pop()?.replace(/\.pdf$/i, '') || `${Date.now()}`;
    const folder = `cv-previews/${userId}/${baseId}`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const uploadedPaths: string[] = [];
    // High DPI rendering factor
    const scale = 3.5; // tuned for crisp text while keeping size reasonable

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) continue;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ canvas: canvas as any, canvasContext: ctx as any, viewport }).promise;

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.95)
      );
      if (!blob) continue;

      const path = `${folder}/page-${i}@2x.webp`;
      const { error: upErr } = await supabase.storage
        .from('job-applications')
        .upload(path, blob, { contentType: 'image/webp', upsert: true });
      if (!upErr) uploadedPaths.push(path);
    }

    // Write small manifest for quick discovery
    const manifest = {
      pages: uploadedPaths.length,
      createdAt: new Date().toISOString(),
      pdfPath: pdfStoragePath,
      scale,
    };
    await supabase.storage
      .from('job-applications')
      .upload(`${folder}/manifest.json`, new Blob([JSON.stringify(manifest)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' });

    return { paths: uploadedPaths };
  } catch (error: any) {
    console.error('CV preview generation failed:', error);
    return { paths: [], error };
  }
}
