import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { confirmTopUp } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const TopupSuccess: React.FC = () => {
  const query = useQuery();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ref = query.get('ref') || undefined;
      const checkoutId = query.get('checkoutId') || undefined;
      if (!ref && !checkoutId) {
        toast.showToast('No top-up reference found', 'error');
        setLoading(false);
        return;
      }

      try {
        await confirmTopUp({ referenceNumber: ref, checkoutId });
        toast.showToast('Top-up successful — your balance has been updated.', 'success');
        // navigate back to wallet after short delay
        setTimeout(() => navigate('/e-wallet'), 1200);
      } catch (err: any) {
        console.error('Confirm topup failed', err);
        toast.showToast('Top-up confirmation failed. Please check your wallet.', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6 bg-white rounded shadow">
        {loading ? <p>Confirming top-up...</p> : <p>Done. Redirecting...</p>}
      </div>
    </div>
  );
};

export default TopupSuccess;
