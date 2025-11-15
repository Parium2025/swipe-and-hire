import { DataSharingConsent } from '@/components/DataSharingConsent';

const Consent = () => {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Mitt samtycke</h1>
        <p className="text-white">
          Hantera hur din information delas med potentiella arbetsgivare
        </p>
      </div>
      
      <DataSharingConsent />
    </div>
  );
};

export default Consent;