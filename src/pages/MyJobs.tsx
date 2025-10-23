import EmployerDashboard from '@/components/EmployerDashboard';
import EmployerLayout from '@/components/EmployerLayout';
import { useEffect, useState } from 'react';

const MyJobs = () => {
  const [developerView, setDeveloperView] = useState('dashboard');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }, []);

  return (
    <EmployerLayout developerView={developerView} onViewChange={setDeveloperView}>
      <EmployerDashboard />
    </EmployerLayout>
  );
};

export default MyJobs;
