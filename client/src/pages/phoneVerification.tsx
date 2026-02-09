import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp } from '../api/auth';

const PhoneVerification: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const email = localStorage.getItem('pending_verification_email') || '';

  // Timer countdown for resend code
  useEffect(() => {
    if (step === 'otp' && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, timer]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email) {
      alert('Missing signup email. Please sign up again.');
      return;
    }

    setIsLoading(true);
    try {
      await sendOtp({ email });
      
      setStep('otp');
      setTimer(30);
      setCanResend(false);
    } catch (error) {
      console.error('Error sending OTP:', error);
      const err = error as { code?: string; message?: string };
      const detail = err?.code ? `${err.code} ${err.message || ''}`.trim() : err?.message || '';
      if (detail) {
        setErrorMessage(detail);
      }
      alert('Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take last character
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      alert('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await verifyOtp({ email, code: otpCode });
      if (response?.token && response?.user) {
        localStorage.setItem('auth_user', JSON.stringify(response.user));
        localStorage.setItem('auth_token', response.token);
        window.dispatchEvent(new Event('auth_user_updated'));
      }
      localStorage.removeItem('pending_verification_email');
      alert('Email verified successfully!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      const err = error as { code?: string; message?: string };
      const detail = err?.code ? `${err.code} ${err.message || ''}`.trim() : err?.message || '';
      if (detail) {
        setErrorMessage(detail);
      }
      alert('Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      await sendOtp({ email });
      
      setTimer(30);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      alert('Verification code sent!');
    } catch (error) {
      console.error('Error resending OTP:', error);
      const err = error as { code?: string; message?: string };
      const detail = err?.code ? `${err.code} ${err.message || ''}`.trim() : err?.message || '';
      if (detail) {
        setErrorMessage(detail);
      }
      alert('Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/signin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2942] to-[#0f1820] p-4 page-transition">
      <div className="w-full max-w-md">
        {/* Email Input Screen */}
        {step === 'email' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {/* Back Button */}
            <button
              onClick={handleBackToLogin}
              className="mb-6 flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
              Email Verification
            </h2>
            <p className="text-center text-gray-500 text-sm mb-8">
              We will send a 6-digit code to your email address.
            </p>

            {/* Form */}
            <form onSubmit={handleEmailSubmit}>
              {errorMessage && (
                <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}
              <div className="mb-6">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    readOnly
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                  <svg
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l9 6 9-6M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"
                    />
                  </svg>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-[#1e3a5f] text-white py-3 rounded-xl font-semibold hover:bg-[#2d5080] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Sending...' : 'Send Verification Code'}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full text-[#1e3a5f] font-medium hover:underline"
              >
                Back to Login
              </button>
            </form>
          </div>
        )}

        {/* OTP Verification Screen */}
        {step === 'otp' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {/* Back Button */}
            <button
              onClick={() => setStep('email')}
              className="mb-6 flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
              Verify Email
            </h2>
            <p className="text-center text-gray-500 text-sm mb-2">
              We've sent a 6-digit code to
            </p>

            {errorMessage && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            )}
            <p className="text-center text-gray-700 font-medium mb-8">
              {email}
            </p>

            {/* Form */}
            <form onSubmit={handleOtpSubmit}>
              {/* OTP Input Boxes */}
              <div className="flex justify-center gap-2 mb-6">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full bg-[#1e3a5f] text-white py-3 rounded-xl font-semibold hover:bg-[#2d5080] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className="text-center">
                <span className="text-gray-600 text-sm">
                  Didn't receive the code?{' '}
                </span>
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="text-[#1e3a5f] font-medium hover:underline disabled:opacity-50"
                  >
                    Resend Code
                  </button>
                ) : (
                  <span className="text-[#1e3a5f] font-medium">
                    Resend Code (0:{timer.toString().padStart(2, '0')})
                  </span>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhoneVerification;
