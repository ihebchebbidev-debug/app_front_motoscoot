/**
 * ClerkIsland — the only part of the app that needs Clerk (Google/Apple
 * sign-in). Lazy-loaded by App so the ~250 KB Clerk runtime is not
 * downloaded on every page view (PageSpeed). Mounted only when the login
 * window opens, on /sso-callback, or when a Clerk session cookie exists.
 */
import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import LoginModal from './LoginModal';
import ClerkAuthBridge from './ClerkAuthBridge';
import { getClerkPublishableKey } from '../../utils/clerkConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

const ClerkIsland: React.FC<Props> = ({ isOpen, onClose, onLogin }) => {
  const key = getClerkPublishableKey();
  const inner = (
    <>
      <LoginModal isOpen={isOpen} onClose={onClose} onLogin={onLogin} />
      <ClerkAuthBridge onLogin={onLogin} />
    </>
  );
  return key ? (
    <ClerkProvider publishableKey={key} afterSignOutUrl="/">
      {inner}
    </ClerkProvider>
  ) : inner;
};

export default ClerkIsland;
