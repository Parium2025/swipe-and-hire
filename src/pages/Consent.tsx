import { DataSharingConsent } from '@/components/DataSharingConsent';

const Consent = () => {
  return (
     <div className="max-w-4xl mx-auto px-3 md:px-8 py-6 animate-fade-in">
      <div className="mb-6 text-center">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Mitt samtycke</h1>
        <p className="text-sm text-white">
          Hantera hur din information delas med potentiella arbetsgivare
        </p>
      </div>
      
      <DataSharingConsent />
    </div>
  );
};

export default Consent;