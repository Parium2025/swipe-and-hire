import EmployerDashboard from '@/components/EmployerDashboard';
import EmployerLayout from '@/components/EmployerLayout';
import { useEffect } from 'react';

const MyJobs = () => {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }, []);

  return (
    <EmployerLayout>
      <EmployerDashboard />
    </EmployerLayout>
  );
};

export default MyJobs;
