'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface UserContextType {
  username: string | null;
  setUsername: (name: string | null) => void;
  isSpectator: boolean;
  setIsSpectator: (isSpectator: boolean) => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [username, setUsernameState] = useState<string | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (storedUsername) {
      setUsernameState(storedUsername);
    }
    setIsLoading(false);
  }, []);

  const setUsername = (name: string | null) => {
    if (name) {
      sessionStorage.setItem('username', name);
    } else {
      sessionStorage.removeItem('username');
    }
    setUsernameState(name);
  };

  return (
    <UserContext.Provider value={{ username, setUsername, isSpectator, setIsSpectator, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
