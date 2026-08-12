import { TruncatedText } from '@/components/TruncatedText';

const title = 'Charlotte Berg tog över vd-skapet – nu har Amanda AI kapat kostnaderna (och fyller på kassan)';
const summary = 'Spiltan-backade Amanda AI har kavlat upp ärmarna. Nu kan Breakit berätta att kostnaderna har kapats ordentligt – personalstyrkan har minskat och bolaget har flyttat in i billigare lokaler.';

export default function TooltipProbe() {
  return (
    <div className="min-h-screen bg-slate-900 p-6 pt-[400px]">
      <div className="w-[320px]">
        <TruncatedText alwaysShowTooltip text={`${title}\n\n${summary}`} className="w-full">
          <div className="w-full" id="probe-trigger">
            <div className="h-[39px] text-sm font-semibold text-white leading-snug mb-2.5 line-clamp-2">{title}</div>
            <div className="h-[36px] text-sm leading-[18px] text-white overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{summary}</div>
          </div>
        </TruncatedText>
      </div>
    </div>
  );
}
