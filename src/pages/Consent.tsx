import { DataSharingConsent } from '@/components/DataSharingConsent';

const Consent = () => {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Datadelning med arbetsgivare</h1>
      </div>
      
      <DataSharingConsent />
    </div>
  );
};

export default Consent;