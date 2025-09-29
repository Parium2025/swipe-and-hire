// Lovable-inspired mobile optimization system
export const getMobileOptimizedClasses = () => {
  return {
    // Container classes for perfect centering like Lovable
    pageContainer: 'min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-parium-gradient',
    
    // Content areas - perfectly centered with generous spacing
    contentArea: 'w-full max-w-sm mx-auto space-y-8 text-center',
    
    // Headers - clean and spacious
    headerSection: 'w-full text-center mb-12',
    headerTitle: 'text-3xl font-bold text-white mb-4',
    headerSubtitle: 'text-lg text-white/70 leading-relaxed',
    
    // Form elements - touch-friendly and beautiful
    formContainer: 'w-full space-y-6',
    inputField: 'w-full h-14 px-6 text-lg rounded-2xl border-2 border-white/20 bg-white/10 text-white placeholder:text-white/60 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300',
    
    // Buttons - optimized for touch
    primaryButton: 'w-full h-14 text-lg font-semibold rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-xl active:scale-98 transition-all duration-200',
    secondaryButton: 'w-full h-14 text-lg font-medium rounded-2xl border-2 border-white/20 text-white hover:bg-white/10 transition-all duration-200',
    
    // Cards - glassmorphism effect like modern designs
    card: 'w-full p-8 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl',
    
    // Navigation - mobile-first
    navigation: 'w-full flex items-center justify-between p-6 border-t border-white/20 bg-black/20 backdrop-blur-sm',
    
    // Spacing utilities
    sectionSpacing: 'space-y-12',
    elementSpacing: 'space-y-6',
    tightSpacing: 'space-y-4'
  };
};

// System för att dynamiskt justera layout baserat på skärmstorlek
export const getResponsiveSpacing = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) {
    return {
      container: 'px-4 py-6',
      section: 'space-y-8',
      element: 'space-y-6'
    };
  } else if (isTablet) {
    return {
      container: 'px-8 py-10',
      section: 'space-y-12',
      element: 'space-y-8'
    };
  } else {
    return {
      container: 'px-12 py-16',
      section: 'space-y-16',
      element: 'space-y-10'
    };
  }
};

export default getMobileOptimizedClasses;