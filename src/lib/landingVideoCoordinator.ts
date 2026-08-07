import { getMaxConcurrentVideos, isAppleDevice } from '@/lib/videoPlatform';

type Registration = { priority: number };

const videos = new Map<HTMLVideoElement, Registration>();
let frame = 0;
let trailingTimer = 0;
let lastRun = 0;
let listenersAttached = false;

const pause = (video: HTMLVideoElement) => {
  if (!video.paused) video.pause();
};

const evaluate = () => {
  frame = 0;
  lastRun = performance.now();
  const width = window.innerWidth || document.documentElement.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;

  const candidates = [...videos.entries()].map(([video, registration]) => {
    const rect = video.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(rect.right, width) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 0));
    const visibleArea = visibleWidth * visibleHeight;
    const distance = Math.hypot(rect.left + rect.width / 2 - centerX, rect.top + rect.height / 2 - centerY);
    return { video, registration, visibleArea, distance };
  });

  const eligible = candidates
    .filter(({ visibleArea }) => !document.hidden && visibleArea > 0)
    .sort((a, b) => b.registration.priority - a.registration.priority || b.visibleArea - a.visibleArea || a.distance - b.distance)
    .slice(0, getMaxConcurrentVideos());
  const granted = new Set(eligible.map(({ video }) => video));

  candidates.forEach(({ video }) => {
    if (!granted.has(video)) {
      pause(video);
      return;
    }
    video.muted = true;
    video.playsInline = true;
    try {
      video.preload = 'auto';
      if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
      if (video.paused) void video.play().catch(() => undefined);
    } catch {
      // Poster remains visible when the browser cannot allocate a decoder.
    }
  });
};

export const scheduleLandingVideoEvaluation = () => {
  if (frame) return;
  const elapsed = performance.now() - lastRun;
  if (elapsed >= 160) {
    frame = window.requestAnimationFrame(evaluate);
    return;
  }
  if (trailingTimer) return;
  trailingTimer = window.setTimeout(() => {
    trailingTimer = 0;
    scheduleLandingVideoEvaluation();
  }, 160 - elapsed);
};

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  const root = document.querySelector('[data-landing-scroll-root]');
  root?.addEventListener('scroll', scheduleLandingVideoEvaluation, { passive: true });
  window.addEventListener('scroll', scheduleLandingVideoEvaluation, { passive: true });
  window.addEventListener('resize', scheduleLandingVideoEvaluation, { passive: true });
  window.addEventListener('pageshow', scheduleLandingVideoEvaluation);
  document.addEventListener('visibilitychange', scheduleLandingVideoEvaluation);
};

export const registerLandingVideo = (video: HTMLVideoElement, priority = 0) => {
  // Apple hardware handles several streams reliably; the coordinator still
  // releases off-screen decoders but preserves the existing richer playback.
  videos.set(video, { priority: isAppleDevice() ? 0 : priority });
  attachListeners();
  const resync = () => scheduleLandingVideoEvaluation();
  video.addEventListener('canplay', resync);
  video.addEventListener('loadeddata', resync);
  video.addEventListener('playing', resync);
  scheduleLandingVideoEvaluation();

  return () => {
    videos.delete(video);
    video.removeEventListener('canplay', resync);
    video.removeEventListener('loadeddata', resync);
    video.removeEventListener('playing', resync);
    pause(video);
    scheduleLandingVideoEvaluation();
  };
};