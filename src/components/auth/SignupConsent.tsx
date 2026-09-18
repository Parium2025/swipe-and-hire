import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';

type SignupConsentProps = {
  role: 'job_seeker' | 'employer';
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
};

/**
 * GDPR-samtycke vid registrering.
 * Arbetsgivare godkänner även personuppgiftsbiträdesavtalet (GDPR art. 28),
 * eftersom de blir personuppgiftsansvariga för kandidatdata i sina annonser.
 */
export function SignupConsent({ role, checked, onCheckedChange, id = 'signup-consent' }: SignupConsentProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/5 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5 border-white/40 data-[state=checked]:bg-secondary data-[state=checked]:text-primary"
      />
      <label htmlFor={id} className="cursor-pointer text-xs leading-5 text-white">
        Jag godkänner{' '}
        <Link
          to="/integritetspolicy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          integritetspolicyn
        </Link>
        {role === 'employer' ? (
          <>
            {' '}och{' '}
            <Link
              to="/dpa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              personuppgiftsbiträdesavtalet
            </Link>
            {' '}(GDPR art. 28).
          </>
        ) : (
          <> och hur mina uppgifter behandlas.</>
        )}
      </label>
    </div>
  );
}

export default SignupConsent;
