'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface Insight {
  type: 'driver' | 'negative_impact' | 'exit_magnet' | 'banner_blindness' | 'path_bottleneck' | 'segment_issue' | 'variant_explanation';
  elementId: string;
  label?: string;
  role?: string;
  metrics: {
    lift_pp: number;
    exit_delta_pp: number;
    n: number;
    ctr: number;
    fi: number;
    lift_ci: [number, number];
    exit_ci: [number, number];
  };
  priority: number;
  recommendations: Array<{
    title: string;
    impact_estimate_pp: number;
    effort: number;
    rationale: string;
  }>;
  experiments: Array<{
    name: string;
    primary_metric: string;
    guardrails: string[];
    success: string;
  }>;
}

interface OverlayContextType {
  isOverlayVisible: boolean;
  insights: Insight[];
  toggleOverlay: (insights: Insight[], projectId?: string) => void;
  closeOverlay: () => void;
}

const OverlayContext = createContext<OverlayContextType | undefined>(undefined);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);

  const toggleOverlay = (newInsights: Insight[], projectId?: string) => {
    if (isOverlayVisible) {
      setIsOverlayVisible(false);
      setInsights([]);
    } else {
      setInsights(newInsights);
      setIsOverlayVisible(true);
    }
  };

  const closeOverlay = () => {
    setIsOverlayVisible(false);
    setInsights([]);
  };

  return (
    <OverlayContext.Provider
      value={{
        isOverlayVisible,
        insights,
        toggleOverlay,
        closeOverlay,
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay() {
  const context = useContext(OverlayContext);
  if (context === undefined) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
}


