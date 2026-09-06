import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ProfileVideo from '@/components/ProfileVideo';
import ProfileVideoCircle from '@/components/ProfileVideoCircle';
import { CriterionIconBadge, CriteriaSummaryPill } from '@/components/criteria/CriteriaBadges';

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
  /** Urvalskriterier med AI-resultat — visas som märken under namnet. */
  criteria?: { criterion_id: string; title: string; result: 'match' | 'no_match' | 'no_data' }[];
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
  criteria,
  onOpen,


}: CandidateCardFaceProps) {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim();
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const showVideo = Boolean(hasVideo && videoUrl);
  const stillImage = profileImageUrl || coverImageUrl || '';

  // Helskärmsläge: media fyller hela kortet, precis som jobbsökarens svepkort.
  if (fullBleed) {
    const circleClass =
      'h-[min(56vw,14rem)] w-[min(56vw,14rem)] overflow-hidden rounded-full border-4 border-white/30 shadow-2xl';

    return (
      <div
        className="w-full h-full relative overflow-hidden select-none flex flex-col [-webkit-tap-highlight-color:transparent]"
        onClick={onOpen}
        onDragStart={(e) => e.preventDefault()}
        style={{ cursor: onOpen ? 'pointer' : 'default' }}
      >
        {stillImage && !showVideo ? (
          <img
            src={stillImage}
            alt={fullName ? `Profilbild för ${fullName}` : 'Profilbild'}
            className="absolute inset-0 w-full h-full object-cover"
            decoding="async"
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 bg-parium-gradient" />
        )}

        {/* Mediazon — cirkeln lever i eget flödesutrymme och kan aldrig nå namnet */}
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6 pt-10 pb-4">
          {showVideo ? (
            <ProfileVideoCircle
              videoUrl={videoUrl as string}
              coverImageUrl={coverImageUrl || profileImageUrl || undefined}
              posterUrl={posterUrl || undefined}
              userInitials={initials}
              alt={fullName ? `Profilvideo för ${fullName}` : 'Profilvideo'}
              circleClassName={`${circleClass} bg-white/10 backdrop-blur-sm`}
              barClassName="w-[min(56vw,14rem)]"
            />
          ) : !stillImage ? (

            <div className="flex h-[min(38vw,9.5rem)] w-[min(38vw,9.5rem)] items-center justify-center overflow-hidden rounded-full border-4 border-white/30 bg-white/10 shadow-2xl backdrop-blur-sm">
              <span className="text-4xl font-bold text-white">{initials}</span>
            </div>
          ) : null}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 pointer-events-none" />

        <div className={`relative z-10 shrink-0 px-5 text-left pointer-events-none ${contentBottomClassName}`}>
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

          {criteria && criteria.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <CriteriaSummaryPill results={criteria} totalCriteria={criteria.length} />
              {criteria.slice(0, 4).map((c) => (
                <CriterionIconBadge key={c.criterion_id} result={c.result} title={c.title} />
              ))}
              {criteria.length > 4 && (
                <span className="rounded px-1.5 py-0.5 text-[10px] text-white/80 ring-1 ring-inset ring-white/20">
                  +{criteria.length - 4}
                </span>
              )}
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
            className="relative z-10 mt-12 mx-auto w-[165px]"
            style={{ cursor: onOpen ? 'pointer' : 'default' }}
            onClick={(e) => {
              if (showVideo) e.stopPropagation();
            }}
          >
            {showVideo ? (
              <ProfileVideoCircle
                videoUrl={videoUrl as string}
                coverImageUrl={coverImageUrl || profileImageUrl || undefined}
                posterUrl={posterUrl || undefined}
                userInitials={initials}
                alt="Profilvideo"
                circleClassName="w-[165px] h-[165px] overflow-hidden rounded-full"
                barClassName="w-[165px]"
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
