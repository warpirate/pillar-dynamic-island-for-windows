import { createElement, useCallback, useRef, useEffect, useState } from "react";

export type AnnouncementPriority = "polite" | "assertive";

export interface ScreenReaderConfig {
  defaultPriority?: AnnouncementPriority;
  announcementDelay?: number;
  deduplicate?: boolean;
  deduplicationWindow?: number;
}

export interface UseScreenReaderReturn {
  announce: (message: string, priority?: AnnouncementPriority) => void;
  clearAnnouncements: () => void;
  politeAnnouncement: string | null;
  assertiveAnnouncement: string | null;
}

interface ScreenReaderLiveRegionsProps {
  polite: string | null;
  assertive: string | null;
}

const DEFAULT_CONFIG: Required<ScreenReaderConfig> = {
  defaultPriority: "polite",
  announcementDelay: 100,
  deduplicate: true,
  deduplicationWindow: 5000,
};

export function useScreenReader(config: ScreenReaderConfig = {}): UseScreenReaderReturn {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [politeAnnouncement, setPoliteAnnouncement] = useState<string | null>(null);
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState<string | null>(null);
  const announcementHistoryRef = useRef<Array<{ message: string; timestamp: number }>>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wasRecentlyAnnounced = useCallback((message: string): boolean => {
    if (!fullConfig.deduplicate) return false;
    
    const now = Date.now();
    const cutoff = now - fullConfig.deduplicationWindow;
    
    announcementHistoryRef.current = announcementHistoryRef.current.filter(
      entry => entry.timestamp > cutoff
    );
    
    return announcementHistoryRef.current.some(entry => entry.message === message);
  }, [fullConfig.deduplicate, fullConfig.deduplicationWindow]);

  const announce = useCallback((message: string, priority?: AnnouncementPriority) => {
    const actualPriority = priority || fullConfig.defaultPriority;
    
    if (wasRecentlyAnnounced(message)) {
      return;
    }
    
    announcementHistoryRef.current.push({
      message,
      timestamp: Date.now(),
    });
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (actualPriority === "assertive") {
        setAssertiveAnnouncement(message);
        setPoliteAnnouncement(null);
      } else {
        setPoliteAnnouncement(message);
      }
      
      setTimeout(() => {
        if (actualPriority === "assertive") {
          setAssertiveAnnouncement(null);
        } else {
          setPoliteAnnouncement(null);
        }
      }, 1000);
    }, fullConfig.announcementDelay);
  }, [fullConfig.defaultPriority, fullConfig.announcementDelay, wasRecentlyAnnounced]);

  const clearAnnouncements = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPoliteAnnouncement(null);
    setAssertiveAnnouncement(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    announce,
    clearAnnouncements,
    politeAnnouncement,
    assertiveAnnouncement,
  };
}

export function ScreenReaderLiveRegions({ polite, assertive }: ScreenReaderLiveRegionsProps) {
  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: "0",
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: "0",
      },
    },
    createElement(
      "div",
      { "aria-live": "polite", "aria-atomic": "true" },
      polite || ""
    ),
    createElement(
      "div",
      { "aria-live": "assertive", "aria-atomic": "true" },
      assertive || ""
    )
  );
}

export function useAnnounceStateChange(announce: UseScreenReaderReturn["announce"]) {
  const prevValuesRef = useRef<Map<string, any>>(new Map());

  return useCallback(<T>(
    current: T,
    previous: T | undefined,
    getMessage: (value: T, prev: T | undefined) => string | null,
    key?: string
  ) => {
    const cacheKey = key || String(current);
    const prevValue = previous !== undefined ? previous : prevValuesRef.current.get(cacheKey);
    
    if (current !== prevValue) {
      const message = getMessage(current, prevValue);
      if (message) {
        announce(message);
      }
      prevValuesRef.current.set(cacheKey, current);
    }
  }, [announce]);
}

export function useAnnounceListChange(announce: UseScreenReaderReturn["announce"]) {
  const prevLengthsRef = useRef<Map<string, number>>(new Map());

  return useCallback(<T>(
    current: T[],
    previous: T[] | undefined,
    singularName: string,
    pluralName: string,
    key?: string
  ) => {
    const cacheKey = key || "list";
    const prevLength = previous !== undefined ? previous.length : prevLengthsRef.current.get(cacheKey) ?? 0;
    const currentLength = current.length;
    
    if (currentLength !== prevLength) {
      const diff = currentLength - prevLength;
      if (diff > 0) {
        const count = diff === 1 ? `1 new ${singularName}` : `${diff} new ${pluralName}`;
        announce(count);
      } else if (diff < 0) {
        const count = Math.abs(diff) === 1 ? `1 ${singularName} removed` : `${Math.abs(diff)} ${pluralName} removed`;
        announce(count);
      }
      prevLengthsRef.current.set(cacheKey, currentLength);
    }
  }, [announce]);
}
