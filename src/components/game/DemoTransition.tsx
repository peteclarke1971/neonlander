import React from 'react';

interface DemoTransitionProps {
  isVisible: boolean;
  children: React.ReactNode;
}

export const DemoTransition: React.FC<DemoTransitionProps> = ({ isVisible, children }) => {
  return (
    <div 
      className={`transition-opacity duration-1000 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {children}
    </div>
  );
};