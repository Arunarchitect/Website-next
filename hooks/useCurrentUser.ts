// @/hooks/useCurrentUser.ts
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { useEffect, useState } from 'react';

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  display_name: string;
  username: string;
}

export const useCurrentUser = (): CurrentUser | null => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const reduxUser = useSelector((state: RootState) => state.auth.user);
  
  useEffect(() => {
    // If Redux has user data, use it
    if (reduxUser) {
      console.log('✅ Using user from Redux:', reduxUser);
      setUser({
        id: reduxUser.id || 0,
        email: reduxUser.email || '',
        first_name: reduxUser.first_name || '',
        last_name: reduxUser.last_name || '',
        full_name: reduxUser.full_name || reduxUser.name || 
                   `${reduxUser.first_name || ''} ${reduxUser.last_name || ''}`.trim(),
        display_name: reduxUser.display_name || reduxUser.full_name || 
                     reduxUser.name || reduxUser.email || '',
        username: reduxUser.username || reduxUser.email?.split('@')[0] || '',
      });
      return;
    }
    
    // Try to get from localStorage
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          console.log('✅ Loading user from localStorage:', parsed);
          
          const userData: CurrentUser = {
            id: parsed.id || 0,
            email: parsed.email || '',
            first_name: parsed.first_name || '',
            last_name: parsed.last_name || '',
            full_name: parsed.full_name || `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim(),
            display_name: parsed.display_name || parsed.full_name || parsed.email || '',
            username: parsed.username || parsed.email?.split('@')[0] || '',
          };
          
          setUser(userData);
          return;
        } catch (e) {
          console.error('Failed to parse user from localStorage:', e);
        }
      }
    }
    
    setUser(null);
  }, [reduxUser]);
  
  return user;
};