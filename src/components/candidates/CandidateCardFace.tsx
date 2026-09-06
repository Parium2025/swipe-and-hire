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
  /**
   * Helskärmsläge (arbetsgivarens svepvy): bilden fyller hela kortet och
   * saknad bild ersätts av ett stort monogram. Jobbsökarens förhandsvisning
   * påverkas inte.
   */
  fullBleed?: boolean;
  /** Extra bottenutrymme i helskärmsläget (t.ex. när knappraden ligger i kortet). */
  contentBottomClassName?: string;
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
  fullBleed = false,
  contentBottomClassName = 'pb-6',
  onOpen,

}: CandidateCardFaceProps) {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim();
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const showVideo = Boolean(hasVideo && videoUrl);
  const stillImage = profileImageUrl || coverImageUrl || '';

  // Helskärmsläge: media fyller hela kortet, precis som jobbsökarens svepkort.
  if (fullBleed) {
    return (
      <div
        className="w-full h-full relative overflow-hidden select-none [-webkit-tap-highlight-color:transparent]"
        onClick={onOpen}
        onDragStart={(e) => e.preventDefault()}
        style={{ cursor: onOpen ? 'pointer' : 'default' }}
      >
        {showVideo ? (
          <div className="absolute inset-0 bg-parium-gradient">
            <div
              className="absolute left-1/2 top-[42%] h-[min(64vw,17rem)] w-[min(64vw,17rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-4 border-white/30 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <ProfileVideo
                videoUrl={videoUrl as string}
                coverImageUrl={coverImageUrl || profileImageUrl || undefined}
                posterUrl={posterUrl || undefined}
                userInitials={initials}
                alt={fullName ? `Profilvideo för ${fullName}` : 'Profilvideo'}
                className="h-full w-full rounded-full"
                countdownVariant="circle"
                showCountdown={true}
                showProgressBar={false}
                disablePlayback={false}
              />
            </div>
          </div>
        ) : stillImage ? (
          <img
            src={stillImage}
            alt={fullName ? `Profilbild för ${fullName}` : 'Profilbild'}
            className="absolute inset-0 w-full h-full object-cover"
            decoding="async"
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(215,85%,26%)] via-[hsl(215,85%,18%)] to-[hsl(215,85%,12%)]">
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-black tracking-tight text-white/10 leading-none"
                style={{ fontSize: 'min(46vw, 15rem)' }}
                aria-hidden="true"
              >
                {initials}
              </span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-40 w-40 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm shadow-2xl">
                <span className="text-5xl font-bold text-white">{initials}</span>
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 pointer-events-none" />

        <div className={`absolute inset-x-0 bottom-0 z-10 px-5 text-left pointer-events-none ${contentBottomClassName}`}>

          <TruncatedText text={fullName} className="two-line-ellipsis two-line-ellipsis-nopad block w-full">
            <NameAutoFit
              text={fullName}
              className="text-2xl font-bold break-words w-full text-white"
              minFontPx={minNameFontPx}
            />
          </TruncatedText>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-white">
            {showAge && age ? <span>{age} år</span> : null}
            {showAge && age && residence ? <span className="text-white/60">•</span> : null}
            {residence ? <span>Bor i {residence}</span> : null}
          </div>

          {onOpen && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-4 py-2 backdrop-blur-sm">
              <span className="text-sm font-medium text-white">{ctaLabel}</span>
              <ArrowRight className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="w-full h-full relative">
      <Card
        className="bg-transparent border-none shadow-none overflow-hidden rounded-none transition-all duration-300 h-full"
        onClick={onOpen}
        onDragStart={(e) => e.preventDefault()}
        style={{ cursor: onOpen ? 'pointer' : 'default' }}
      >
        <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ cursor: onOpen ? 'pointer' : 'default' }}>
          {/* Bakgrundsgradient — mjuk och ljus, täcker läsbarheten */}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />

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
                <AvatarFallback className="bg-primary/20 text-white text-3xl font-bold">
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
