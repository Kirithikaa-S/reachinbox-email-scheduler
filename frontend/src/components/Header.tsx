import { useAuth } from '../context/AuthContext';
import { SlackButton } from './SlackButton';
import { Button } from './Button';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            R
          </div>
          <span className="text-lg font-bold text-gray-900">ReachInbox</span>
        </div>

        <div className="flex items-center gap-4">
          <SlackButton />

          {user && (
            <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden text-sm sm:block">
                <p className="font-medium text-gray-800">{user.name}</p>
                <p className="text-gray-500">{user.email}</p>
              </div>
              <Button variant="ghost" onClick={logout} className="!px-2 !py-1 text-xs">
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
