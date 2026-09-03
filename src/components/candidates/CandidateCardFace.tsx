import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ProfileVideo from '@/components/ProfileVideo';
import { TruncatedText } from '@/components/TruncatedText';
import NameAutoFit from '@/components/NameAutoFit';

export interface CandidateCardFaceProps {
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  residence?: string | null;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  hasVideo?: boolean;
  /** Visa åldern (döljs när samtycke saknas). */
  showAge?: boolean;
  ctaLabel?: string;
  minNameFontPx?: number;
  onOpen?: () => void;
}

/**
 * Delad kortfront för kandidater — används både i jobbsökarens
 * profilförhandsgranskning och i arbetsgivarens swipe-läge, så att båda
 * vyerna alltid ser exakt likadana ut.
 */
export const CandidateCardFace = memo(function CandidateCardFace({
  firstName,
  lastName,
  age,
  residence,
  profileImageUrl,
  coverImageUrl,
  videoUrl,
  posterUrl,
  hasVideo = false,
  showAge = true,
  ctaLabel = 'Tryck för mer info',
  minNameFontPx = 13,
  onOpen,
}: CandidateCardFaceProps) {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim();
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const showVideo = Boolean(hasVideo && videoUrl);

  return (
    <div className="w-full h-full relative">
      <Card
        className="bg-transparent border-none shadow-none overflow-hidden rounded-none transition-all duration-300 h-full"
        onClick={onOpen}
        onDragStart={(e) => e.preventDefault()}
        style={{ cursor: onOpen ? 'pointer' : 'default' }}
      >
        <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ cursor: onOpen ? 'pointer' : 'default' }}>
          {/* Bakgrundsgradient — mildare och ljusare, täcker läsbarheten */}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

          {/* Avatar/video — nedflyttad för mindre dött space upptill */}
          <div
            className="relative z-10 mt-12 mx-auto w-[165px] h-[165px]"
            style={{ cursor: onOpen ? 'pointer' : 'default' }}
            onClick={(e) => {
              if (showVideo) e.stopPropagation();
            }}
          >
            {showVideo ? (
              <ProfileVideo
                videoUrl={videoUrl as string}
                coverImageUrl={coverImageUrl || profileImageUrl || undefined}
                posterUrl={posterUrl || undefined}
                userInitials={initials}
                alt="Profilbild"
                className="w-full h-full rounded-full"
                countdownVariant="circle"
                showCountdown={true}
                disablePlayback={false}
              />
            ) : (
              <Avatar className="w-[165px] h-[165px] border-2 border-white/40 shadow-2xl">
                <AvatarImage
                  src={profileImageUrl || coverImageUrl || ''}
                  alt="Profilbild"
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/20 text-white text-3xl font-bold" delayMs={200}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Text direkt under profilbilden */}
          {showVideo && (
            <div className="relative z-10 text-center mt-2">
              <p className="text-sm font-medium text-white">Video tillgängligt</p>
            </div>
          )}

          {/* Namn/ålder/ort — centrerat mellan ringen och CTA:n */}
          <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-2 text-center">
            <div className="text-white w-full">
              <TruncatedText
                text={fullName}
                className="two-line-ellipsis two-line-ellipsis-nopad block w-full"
              >
                <NameAutoFit
                  text={fullName}
                  className="text-lg font-bold mb-0.5 break-words w-full text-white"
                  minFontPx={minNameFontPx}
                />
              </TruncatedText>

              <div className="space-y-0.5 text-xs text-white">
                {showAge && age ? <p>{age} år</p> : null}
                {residence ? <p>Bor i {residence}</p> : null}
              </div>
            </div>
          </div>

          {/* CTA — ligger kvar på botten utan glapp */}
          {onOpen && (
            <div className="relative z-10 flex items-center justify-center mb-3">
              <div className="bg-white/20 rounded-md px-2 py-1 flex items-center gap-1">
                <span className="text-xs text-white">{ctaLabel}</span>
                <ArrowRight className="h-3 w-3 text-white" />
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
});

export default CandidateCardFace;
