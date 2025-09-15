export interface PhoneValidationResult {
  isValid: boolean;
  error: string;
}

/**
 * Smart phone validation for Swedish numbers
 * Accepts multiple formats and provides helpful error messages
 */
export const validateSwedishPhoneNumber = (phoneNumber: string, isRequired: boolean = true): PhoneValidationResult => {
  if (!phoneNumber.trim()) {
    return { 
      isValid: !isRequired, 
      error: isRequired ? 'Telefonnummer är obligatoriskt' : '' 
    };
  }
  
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Check different Swedish number formats
  if (cleaned.startsWith('+46')) {
    const digitsAfterPrefix = cleaned.substring(3);
    
    // Need exactly 9 digits after +46 (total 12 characters: +46xxxxxxxxx)
    if (digitsAfterPrefix.length !== 9) {
      return {
        isValid: false,
        error: `+46-nummer behöver 9 siffror efter +46 (du har ${digitsAfterPrefix.length})`
      };
    }
    
    // Check if it starts with valid Swedish mobile prefixes (70-76)
    if (!digitsAfterPrefix.match(/^7[0-6]/)) {
      return {
        isValid: false,
        error: 'Ange ett giltigt svenskt mobilnummer (ex: +46 70, +46 73, +46 76)'
      };
    }
    
    return { isValid: true, error: '' };
    
  } else if (cleaned.startsWith('0046')) {
    const digitsAfterPrefix = cleaned.substring(4);
    
    if (digitsAfterPrefix.length !== 9) {
      return {
        isValid: false,
        error: `0046-nummer behöver 9 siffror efter 0046 (du har ${digitsAfterPrefix.length})`
      };
    }
    
    if (!digitsAfterPrefix.match(/^7[0-6]/)) {
      return {
        isValid: false,
        error: 'Ange ett giltigt svenskt mobilnummer (ex: 0046 70, 0046 73)'
      };
    }
    
    return { isValid: true, error: '' };
    
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    const digitsAfterZero = cleaned.substring(1);
    
    if (!digitsAfterZero.match(/^7[0-6]/)) {
      return {
        isValid: false,
        error: 'Ange ett giltigt svenskt mobilnummer (ex: 070, 073, 076)'
      };
    }
    
    return { isValid: true, error: '' };
    
  } else if (cleaned.match(/^\d{9}$/)) {
    // Just 9 digits, check if it's a valid mobile number
    if (!cleaned.match(/^7[0-6]/)) {
      return {
        isValid: false,
        error: 'Mobilnummer måste börja med 70-76'
      };
    }
    
    return { isValid: true, error: '' };
  }
  
  return {
    isValid: false,
    error: 'Ange ett giltigt svenskt telefonnummer (ex: 070-123 45 67 eller +46 70 123 45 67)'
  };
};

/**
 * Legacy validation function for backward compatibility
 * Used in Profile.tsx for simpler regex-based validation
 */
export const isValidSwedishPhone = (value: string): boolean => {
  const digits = value.replace(/\s+/g, '');
  return /^(\+46|0)[1-9][0-9]{7,9}$/.test(digits);
};