import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LandingV2Button from './Button';

const LandingV2Footer = () => {
  const navigate = useNavigate();
  return (
    <footer className="relative z-10 mx-auto w-full max-w-[1200px] py-12 px-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
        <LandingV2Button
          variant="primary"
          onClick={() => {
            sessionStorage.setItem('parium-skip-splash', '1');
            navigate('/auth');
          }}
        >
          Kom igång
        </LandingV2Button>

        <div className="flex items-start gap-6">
          <ArrowUpRight className="w-5 h-5 text-white/80 mt-1" />
          <div className="flex gap-12">
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href="#features"
                  className="text-base text-white/85 hover:opacity-70 transition"
                >
                  Funktioner
                </a>
              </li>
              <li>
                <a
                  href="#projects"
                  className="text-base text-white/85 hover:opacity-70 transition"
                >
                  Cases
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  className="text-base text-white/85 hover:opacity-70 transition"
                >
                  Om oss
                </a>
              </li>
            </ul>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href="https://x.com/parium"
                  target="_blank"
                  rel="noreferrer"
                  className="text-base text-white/85 hover:opacity-70 transition"
                >
                  x.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/parium"
                  target="_blank"
                  rel="noreferrer"
                  className="text-base text-white/85 hover:opacity-70 transition"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingV2Footer;
