import { useState, useCallback, useEffect, useRef } from 'react';

interface DropdownState {
  isOpen: boolean;
  searchTerm: string;
}

type DropdownKeys = 
  | 'employmentType'
  | 'salaryType'
  | 'salaryTransparency'
  | 'workLocation'
  | 'remoteWork'
  | 'occupation'
  | 'city'
  | 'questionType'
  | 'benefits';

type DropdownStates = Record<DropdownKeys, DropdownState>;

const initialState: DropdownStates = {
  employmentType: { isOpen: false, searchTerm: '' },
  salaryType: { isOpen: false, searchTerm: '' },
  salaryTransparency: { isOpen: false, searchTerm: '' },
  workLocation: { isOpen: false, searchTerm: '' },
  remoteWork: { isOpen: false, searchTerm: '' },
  occupation: { isOpen: false, searchTerm: '' },
  city: { isOpen: false, searchTerm: '' },
  questionType: { isOpen: false, searchTerm: '' },
  benefits: { isOpen: false, searchTerm: '' },
};

export const useDropdownState = () => {
  const [dropdowns, setDropdowns] = useState<DropdownStates>(initialState);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close all dropdowns
  const closeAllDropdowns = useCallback(() => {
    setDropdowns(prev => {
      const newState = { ...prev };
      (Object.keys(newState) as DropdownKeys[]).forEach(key => {
        newState[key] = { ...newState[key], isOpen: false };
      });
      return newState;
    });
  }, []);

  // Toggle a specific dropdown (closing others)
  const toggleDropdown = useCallback((key: DropdownKeys) => {
    setDropdowns(prev => {
      const newState = { ...prev };
      const isCurrentlyOpen = prev[key].isOpen;
      
      // Close all dropdowns first
      (Object.keys(newState) as DropdownKeys[]).forEach(k => {
        newState[k] = { ...newState[k], isOpen: false };
      });
      
      // Toggle the target dropdown
      if (!isCurrentlyOpen) {
        newState[key] = { ...newState[key], isOpen: true };
      }
      
      return newState;
    });
  }, []);

  // Set search term for a dropdown
  const setSearchTerm = useCallback((key: DropdownKeys, term: string) => {
    setDropdowns(prev => ({
      ...prev,
      [key]: { ...prev[key], searchTerm: term }
    }));
  }, []);

  // Open a dropdown
  const openDropdown = useCallback((key: DropdownKeys) => {
    setDropdowns(prev => {
      const newState = { ...prev };
      // Close all others
      (Object.keys(newState) as DropdownKeys[]).forEach(k => {
        newState[k] = { ...newState[k], isOpen: false };
      });
      // Open target
      newState[key] = { ...newState[key], isOpen: true };
      return newState;
    });
  }, []);

  // Close a specific dropdown
  const closeDropdown = useCallback((key: DropdownKeys) => {
    setDropdowns(prev => ({
      ...prev,
      [key]: { ...prev[key], isOpen: false }
    }));
  }, []);

  // Reset all search terms
  const resetSearchTerms = useCallback(() => {
    setDropdowns(prev => {
      const newState = { ...prev };
      (Object.keys(newState) as DropdownKeys[]).forEach(key => {
        newState[key] = { ...newState[key], searchTerm: '' };
      });
      return newState;
    });
  }, []);

  // Reset all state
  const resetAll = useCallback(() => {
    setDropdowns(initialState);
  }, []);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeAllDropdowns]);

  // Individual dropdown getters for convenience
  const getDropdownState = useCallback((key: DropdownKeys) => dropdowns[key], [dropdowns]);

  return {
    dropdowns,
    containerRef,
    toggleDropdown,
    openDropdown,
    closeDropdown,
    closeAllDropdowns,
    setSearchTerm,
    resetSearchTerms,
    resetAll,
    getDropdownState,
    // Convenience accessors
    employmentType: dropdowns.employmentType,
    salaryType: dropdowns.salaryType,
    salaryTransparency: dropdowns.salaryTransparency,
    workLocation: dropdowns.workLocation,
    remoteWork: dropdowns.remoteWork,
    occupation: dropdowns.occupation,
    city: dropdowns.city,
    questionType: dropdowns.questionType,
    benefits: dropdowns.benefits,
  };
};

export type { DropdownKeys, DropdownState, DropdownStates };
