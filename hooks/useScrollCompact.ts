import { useState, useEffect } from 'react';

export function useScrollCompact(threshold = 24) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > threshold) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isCompact;
}
