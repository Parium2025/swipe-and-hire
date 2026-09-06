import { useCallback, useRef, useState } from 'react';
import ProfileVideo from '@/components/ProfileVideo';
import VideoScrubBar from '@/components/VideoScrubBar';

interface ProfileVideoCircleProps {
  videoUrl: string;
  coverImageUrl?: string;
  posterUrl?: string | null;
  userInitials?: string;
  alt?: string;
  /** Klasser för själva cirkeln (storlek, ram, rundning). */
  circleClassName?: string;
  /** Klasser för ytterlagret som håller cirkel + list. */
  wrapperClassName?: string;
  /** Klasser för listens bredd — matchar normalt cirkelns bredd. */
  barClassName?: string;
  showCountdown?: boolean;
  disablePlayback?: boolean;
}

/**
 * Rund profilvideo med uppspelningslist UNDER cirkeln. Listen visas först när
 * videon spelar och går att dra i, med sekundvisare — samma beteende överallt
 * där profilvideor visas.
 */
export function ProfileVideoCircle({
  videoUrl,
  coverImageUrl,
  posterUrl,
  userInitials = '?',
  alt = 'Profilvideo',
  circleClassName = '',
  wrapperClassName = '',
  barClassName = '',
  showCountdown = true,
  disablePlayback = false,
}: ProfileVideoCircleProps) {
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const seekRef = useRef<((seconds: number) => void) | null>(null);

  const handleTimeChange = useCallback((current: number, duration: number) => {
    setTime({ current, duration: Number.isFinite(duration) ? duration : 0 });
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    seekRef.current?.(seconds);
  }, []);

  return (
    <div className={`flex flex-col items-center ${wrapperClassName}`}>
      <div className={circleClassName} onClick={(e) => e.stopPropagation()}>
        <ProfileVideo
          videoUrl={videoUrl}
          coverImageUrl={coverImageUrl}
          posterUrl={posterUrl || undefined}
          userInitials={userInitials}
          alt={alt}
          className="h-full w-full rounded-full"
          countdownVariant="circle"
          showCountdown={false}
          showProgressBar={false}
          disablePlayback={disablePlayback}
          onPlayingChange={setIsPlaying}
          onTimeChange={handleTimeChange}
          seekRef={seekRef}
        />
      </div>

      <div
        className={`mt-2 transition-opacity duration-200 ${barClassName} ${
          showCountdown && isPlaying && time.duration > 0 ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <VideoScrubBar current={time.current} duration={time.duration} onSeek={handleSeek} />
      </div>
    </div>
  );
}

export default ProfileVideoCircle;
