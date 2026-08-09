import { ReactNode } from 'react';

interface AuthFieldNoticeProps {
  show: boolean;
  children: ReactNode;
}

/**
 * Mjuk in-/utfasning för hjälptexter under auth-fält.
 * Håller innehållet monterat så att både in- och utgången animeras.
 */
export const AuthFieldNotice = ({ show, children }: AuthFieldNoticeProps) => (
  <div
    aria-hidden={!show}
    className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
      show ? 'grid-rows-[1fr] opacity-100 mt-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
    }`}
  >
    <div className="overflow-hidden">{children}</div>
  </div>
);

export default AuthFieldNotice;
