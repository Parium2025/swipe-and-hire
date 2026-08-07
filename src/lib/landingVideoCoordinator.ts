import { getMaxConcurrentVideos, isAppleDevice } from '@/lib/videoPlatform';

type Registration = { priority: number; isActive: () => boolean };

const videos = new Map<HTMLVideoElement, Registration>();
let frame = 0;
let trailingTimer = 0;
let lastRun = 0;
let listenersAttached = false;
let scrollRoot: Element | null = null;

const pause = (video: HTMLVideoElement) => {
  if (!video.paused) video.pause();
};

const clearPendingEvaluation = () => {
  if (frame) window.cancelAnimationFrame(frame);
  if (trailingTimer) window.clearTimeout(trailingTimer);
  frame = 0;
  trailingTimer = 0;
};

const pauseAll = () => {
  videos.forEach((_registration, video) => pause(video));
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
    return { video, registration, visibleArea, distance, active: registration.isActive() };
  });

  const eligible = candidates
    .filter(({ visibleArea, active }) => !document.hidden && active && visibleArea > 0)
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
  // Chromium stryper timers i bakgrundsflikar, ibland till en minut. En tidigare
  // trailing-timer kunde därför ligga kvar som "pågående" när fliken blev synlig
  // igen och blockera hela playback-koordinatorn. Dold sida ska aldrig köa arbete:
  // pausa direkt och låt visibility/pageshow skapa en helt ny evaluation.
  if (document.hidden) {
    clearPendingEvaluation();
    pauseAll();
    return;
  }
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

const resumeImmediately = () => {
  clearPendingEvaluation();
  lastRun = 0;
  if (document.hidden) {
    pauseAll();
    return;
  }
  frame = window.requestAnimationFrame(evaluate);
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    clearPendingEvaluation();
    pauseAll();
    return;
  }
  resumeImmediately();
};

const handlePageHide = () => {
  clearPendingEvaluation();
  pauseAll();
};

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  scrollRoot = document.querySelector('[data-landing-scroll-root]');
  scrollRoot?.addEventListener('scroll', scheduleLandingVideoEvaluation, { passive: true });
  window.addEventListener('scroll', scheduleLandingVideoEvaluation, { passive: true });
  window.addEventListener('resize', scheduleLandingVideoEvaluation, { passive: true });
  window.addEventListener('pageshow', resumeImmediately);
  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibilityChange);
};

const detachListeners = () => {
  if (!listenersAttached || videos.size > 0) return;
  listenersAttached = false;
  scrollRoot?.removeEventListener('scroll', scheduleLandingVideoEvaluation);
  scrollRoot = null;
  window.removeEventListener('scroll', scheduleLandingVideoEvaluation);
  window.removeEventListener('resize', scheduleLandingVideoEvaluation);
  window.removeEventListener('pageshow', resumeImmediately);
  window.removeEventListener('pagehide', handlePageHide);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  clearPendingEvaluation();
  lastRun = 0;
};

export const registerLandingVideo = (video: HTMLVideoElement, priority = 0, isActive: () => boolean = () => true) => {
  // Apple hardware handles several streams reliably; the coordinator still
  // releases off-screen decoders but preserves the existing richer playback.
  videos.set(video, { priority: isAppleDevice() ? 0 : priority, isActive });
  attachListeners();
  const resync = () => scheduleLandingVideoEvaluation();
  video.addEventListener('canplay', resync);
  video.addEventListener('loadeddata', resync);
  scheduleLandingVideoEvaluation();

  return () => {
    videos.delete(video);
    video.removeEventListener('canplay', resync);
    video.removeEventListener('loadeddata', resync);
    pause(video);
    if (videos.size > 0) scheduleLandingVideoEvaluation();
    else detachListeners();
  };
};