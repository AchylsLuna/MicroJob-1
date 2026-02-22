import React, { useEffect, useState } from "react";
import { createTopUpSession, getTransactions, getUserProfile, confirmTopUp } from "../services/api";

const EWallet: React.FC = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [employerBalance, setEmployerBalance] = useState<number | null>(null);
  const [workerBalance, setWorkerBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const MIN_TOPUP = 100;
  const [target, setTarget] = useState<'EMPLOYER' | 'WORKER' | 'BOTH'>('EMPLOYER');
  const [isBothRole, setIsBothRole] = useState(false);
  const pollingRef = React.useRef<number | null>(null);
  const prevEmployerRef = React.useRef<number>(0);
  const prevWorkerRef = React.useRef<number>(0);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await getUserProfile();
      setEmployerBalance(res.profile?.employerBalance ?? 0);
      setWorkerBalance(res.profile?.workerBalance ?? 0);
      if (res.profile?.role === 'both') {
        setIsBothRole(true);
        setTarget('BOTH');
      } else {
        setIsBothRole(false);
      }
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  function TypeIcon({ type }: { type: string }) {
    // simple SVG "stickers" instead of emoji
    if (type === 'TOP_UP') return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#0b47a1" />
        <path d="M12 8v8M8 12h8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    if (type === 'PAYOUT') return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#0b47a1" />
        <path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    if (type === 'ESCROW') return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#0b47a1" />
        <path d="M8 11v-1a4 4 0 118 0v1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#0b47a1" />
        <path d="M9 12h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  const loadTransactions = async () => {
    try {
      const res = await getTransactions();
      const r: any = res;
      if (Array.isArray(r.transactions)) {
        setTransactions(r.transactions);
      } else if (Array.isArray(r)) {
        setTransactions(r as any[]);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Failed to load transactions', err);
    }
  };

  useEffect(() => {
    loadProfile();
    loadTransactions();
  }, []);

  const handleTopUp = async () => {
    try {
      setLoading(true);
      const res = await createTopUpSession({ amount, target });
      if (res.checkoutUrl) {
        // capture current balances so we can detect the update
        prevEmployerRef.current = employerBalance ?? 0;
        prevWorkerRef.current = workerBalance ?? 0;

        // open checkout in new tab
        window.open(res.checkoutUrl, '_blank');

        // start polling to detect balance change (for up to 60s)
        const start = Date.now();
        pollingRef.current = window.setInterval(async () => {
          try {
            // first try server-side confirmation by checkoutId if available
            if (res.checkoutId) {
              try {
                const confirmRes = await confirmTopUp({ checkoutId: res.checkoutId });
                const cr: any = confirmRes;
                if ((typeof cr?.message === 'string' && cr.message.toLowerCase().includes('top-up')) || cr?.transaction) {
                  // success: stop both intervals
                  if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
                  // refresh profile and transactions
                  const profileRes2 = await getUserProfile();
                  const newEmployer2 = profileRes2.profile?.employerBalance ?? 0;
                  const newWorker2 = profileRes2.profile?.workerBalance ?? 0;
                  setEmployerBalance(newEmployer2);
                  setWorkerBalance(newWorker2);
                  await loadTransactions();
                  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Top-up successful — your balance has been updated.', type: 'success' } }));
                  return;
                }
              } catch (e: any) {
                // ignore errors from confirm attempts and continue with profile polling
                console.debug('confirmTopUp attempt failed', e?.message || e);
              }
            }
            // fetch fresh profile directly to avoid stale React state inside interval
            const profileRes = await getUserProfile();
            const newEmployer = profileRes.profile?.employerBalance ?? 0;
            const newWorker = profileRes.profile?.workerBalance ?? 0;

            let detected = false;
            if (target === 'EMPLOYER') {
              if (newEmployer > prevEmployerRef.current) detected = true;
            } else if (target === 'WORKER') {
              if (newWorker > prevWorkerRef.current) detected = true;
            } else { // BOTH
              if (newEmployer > prevEmployerRef.current || newWorker > prevWorkerRef.current) detected = true;
            }

            if (detected) {
              // stop polling
              if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
              // update UI balances from fresh data
              setEmployerBalance(newEmployer);
              setWorkerBalance(newWorker);
              // refresh transactions
              await loadTransactions();
              // dispatch a toast event handled by the ToastProvider
              window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Top-up successful — your balance has been updated.', type: 'success' } }));
            }

            // timeout after 60s
            if (Date.now() - start > 60_000) {
              if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            }
          } catch (e: any) {
            console.error('Polling error', e);
          }
        }, 3000);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to initiate top up');
    } finally {
      setLoading(false);
    }
  };

  // clear polling on unmount
  useEffect(() => {
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, []);

  return (
    <div>
      <div className="bg-white px-8 py-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">E-Wallet</h1>
          <div className="flex items-center gap-3">
            <button className="relative h-9 w-9 rounded-full border border-blue-200 flex items-center justify-center text-blue-700 bg-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M15 17H9" stroke="#0b47a1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 3v2.5" stroke="#0b47a1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 8a6 6 0 01-12 0" stroke="#0b47a1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">3</span>
            </button>
            <div className="h-9 w-9 rounded-full bg-blue-800 text-white flex items-center justify-center font-semibold">JD</div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl p-6 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-base">Employer Balance</p>
              <h2 className="text-4xl font-extrabold mt-1">{loading ? 'Loading...' : `₱${(employerBalance ?? 0).toLocaleString()}`}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
                <span className="px-3 text-gray-700">₱</span>
                {
                  (() => {
                    const formattedAmount = (amount && amount !== 0) ? amount.toLocaleString() : '';
                    return (
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        aria-label="Top up amount"
                        value={formattedAmount}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                          const parsed = raw ? Number(raw) : 0;
                          setAmount(parsed);
                        }}
                        className="p-2 text-black w-28 outline-none"
                      />
                    );
                  })()
                }
              </div>
              <div className="text-xs text-gray-500 mt-1">Enter amount (min ₱100). Commas added automatically.</div>
              {!isBothRole && (
                <select value={target} onChange={(e) => setTarget(e.target.value as any)} className="rounded-md p-2 text-black">
                  <option value="EMPLOYER">Employer</option>
                  <option value="WORKER">Worker</option>
                </select>
              )}
              <button onClick={handleTopUp} disabled={loading || amount < MIN_TOPUP} className={`h-12 px-4 rounded-xl ${amount >= MIN_TOPUP ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'} font-semibold`}>Top Up</button>
            </div>
          </div>

          

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-white/20 rounded-xl p-4">
              <p className="text-sky-100 text-sm">Total Income</p>
              <p className="text-2xl font-bold">₱82,000</p>
            </div>
            <div className="bg-white/20 rounded-xl p-4">
              <p className="text-sky-100 text-sm">Total Expenses</p>
              <p className="text-2xl font-bold">₱10,799</p>
            </div>
          </div>
        </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mt-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600">Worker Balance: <span className="font-semibold">₱{(workerBalance ?? 0).toLocaleString()}</span></p>
              </div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Recent Transactions</h3>
            <button onClick={loadTransactions} className="text-sky-600 text-sm font-semibold hover:text-sky-700">Refresh</button>
          </div>

          <div className="divide-y divide-gray-100">
            {transactions.length === 0 && <p className="text-gray-500">No transactions yet</p>}
            {transactions.map((tx) => {
              const when = new Date(tx.createdAt).toLocaleDateString();
              const subject = tx.jobReference?.title ? tx.jobReference.title : (tx.jobReference ? 'Job' : 'Wallet');
              const actorName = tx.actor?.name || tx.sender?.name || 'System';

              // amount sign and color by type
              let amountSign = '';
              let amountColor = 'text-gray-700';
              if (tx.type === 'TOP_UP' || tx.type === 'PAYOUT' || tx.type === 'REFUND') {
                amountSign = '+';
                amountColor = 'text-green-600';
              } else if (tx.type === 'ESCROW') {
                // escrow is money held from poster, display as negative
                amountSign = '-';
                amountColor = 'text-red-500';
              }

              return (
              <div key={tx._id || tx.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tx.receiver && tx.receiver === tx._id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    <TypeIcon type={tx.type} />
                  </div>
                  <div>
                    {
                      (() => {
                        const title = tx.label || (tx.type + (tx.reference ? ` · ${tx.reference}` : ''));
                        return <p className="text-gray-900 font-semibold text-base">{title}</p>;
                      })()
                    }
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{when}</span>
                      <span>•</span>
                      <span>{subject}</span>
                      <span>•</span>
                      <span>By: {actorName}</span>
                    </div>
                    {tx.meta && tx.reference && tx.label && (
                      <div className="text-xs text-gray-400 mt-1">Ref: {tx.reference}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${amountColor}`}>
                    {amountSign}₱{Math.abs(tx.amount)}
                  </p>
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">{tx.type}</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EWallet;
