import { describe, it, expect } from 'vitest';
import { isAcceptedVideoFile, looksLikeVideoFile } from '/dev-server/src/lib/videoInput';
describe('videoInput', () => {
  it('accepts common mobile formats', () => {
    for (const t of ['video/mp4','video/quicktime','video/webm','video/3gpp','video/x-matroska'])
      expect(isAcceptedVideoFile({ type: t, name: 'a.bin' })).toBe(true);
  });
  it('accepts empty mime via extension (Android/Windows pickers)', () => {
    expect(isAcceptedVideoFile({ type: '', name: 'VID_001.MP4' })).toBe(true);
    expect(isAcceptedVideoFile({ type: 'application/octet-stream', name: 'clip.mov' })).toBe(true);
  });
  it('rejects non-video', () => {
    expect(isAcceptedVideoFile({ type: 'image/png', name: 'a.png' })).toBe(false);
    expect(isAcceptedVideoFile({ type: '', name: 'cv.pdf' })).toBe(false);
  });
  it('looksLikeVideoFile covers both signals', () => {
    expect(looksLikeVideoFile({ type: 'video/avi', name: 'x.avi' })).toBe(true);
    expect(looksLikeVideoFile({ type: '', name: 'x.webm' })).toBe(true);
    expect(looksLikeVideoFile({ type: '', name: 'x.txt' })).toBe(false);
  });
});
