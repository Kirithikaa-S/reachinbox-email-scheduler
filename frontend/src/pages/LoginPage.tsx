import { api } from '../services/api';
import { Button } from '../components/Button';

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            R
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ReachInbox</h1>
          <p className="text-sm text-gray-500">Schedule and track cold email campaigns</p>
        </div>

        <Button
          className="w-full"
          onClick={() => {
            window.location.href = api.googleLoginUrl();
          }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
            />
          </svg>
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-xs text-gray-400">
          By continuing, you agree to use this demo responsibly.
        </p>
      </div>
    </div>
  );
}
