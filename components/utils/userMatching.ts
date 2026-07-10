// @/utils/userMatching.ts

interface UserInfo {
  email: string;
  fullName: string;
  username: string;
  displayName: string;
  id?: number;
  firstName?: string;
  lastName?: string;
}

export const isUserMatch = (
  identifier: string, 
  user: UserInfo | null | undefined
): boolean => {
  if (!identifier || !user || !user.email) return false;
  
  const identifierLower = identifier.toLowerCase().trim();
  
  // If the identifier matches the user's full name (exact match)
  if (user.fullName) {
    const fullNameLower = user.fullName.toLowerCase().trim();
    if (identifierLower === fullNameLower) {
      console.log(`✅ Match found: "${identifier}" === "${fullNameLower}"`);
      return true;
    }
  }
  
  // Check if identifier contains the user's email
  const userEmailLower = user.email.toLowerCase().trim();
  if (identifierLower.includes(userEmailLower)) {
    console.log(`✅ Match found: "${identifier}" contains "${userEmailLower}"`);
    return true;
  }
  
  // Check if identifier contains first name + last name
  if (user.firstName && user.lastName) {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase().trim();
    if (identifierLower === fullName || identifierLower.includes(fullName)) {
      console.log(`✅ Match found: "${identifier}" matches "${fullName}"`);
      return true;
    }
    
    const firstNameLower = user.firstName.toLowerCase().trim();
    const lastNameLower = user.lastName.toLowerCase().trim();
    
    if (firstNameLower.length > 2 && identifierLower.includes(firstNameLower)) {
      console.log(`✅ Match found: "${identifier}" contains "${firstNameLower}"`);
      return true;
    }
    
    if (lastNameLower.length > 2 && identifierLower.includes(lastNameLower)) {
      console.log(`✅ Match found: "${identifier}" contains "${lastNameLower}"`);
      return true;
    }
  }
  
  // Check if identifier contains display name
  if (user.displayName) {
    const displayLower = user.displayName.toLowerCase().trim();
    if (identifierLower.includes(displayLower)) {
      console.log(`✅ Match found: "${identifier}" contains "${displayLower}"`);
      return true;
    }
  }
  
  console.log(`❌ No match: "${identifier}" vs user:`, user);
  return false;
};