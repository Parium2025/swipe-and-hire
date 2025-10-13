import EmployerDashboard from '@/components/EmployerDashboard';
import EmployerLayout from '@/components/EmployerLayout';
import { useState } from 'react';

const MyJobs = () => {
  const [developerView, setDeveloperView] = useState('dashboard');

  return (
    <EmployerLayout developerView={developerView} onViewChange={setDeveloperView}>
      <EmployerDashboard />
    </EmployerLayout>
  );
};

export default MyJobs;
