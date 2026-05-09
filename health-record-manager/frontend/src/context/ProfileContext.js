import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

const ProfileContext = createContext();

// ProfileContext now just exposes the logged-in user as the "active profile"
// so existing components that use useProfile() keep working without changes.
export const ProfileProvider = ({ children }) => {
  const { user } = useAuth();

  // Expose user as activeProfile so pages that call activeProfile._id get user._id
  const activeProfile = user ? { _id: user._id, profileName: user.fullName } : null;

  return (
    <ProfileContext.Provider value={{ activeProfile, loading: false }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
