import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      // dispatch a custom event so other listeners in the same window can react
      try {
        window.dispatchEvent(new CustomEvent('local-storage', { detail: { key, value: valueToStore } }));
      } catch (e) {
        // ignore environments that don't support CustomEvent constructor
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Listen for storage changes from other tabs/windows and custom events in same window
  useEffect(() => {
    function handleStorageEvent(e: StorageEvent) {
      if (!e.key || e.key !== key) return;
      try {
        const newVal = e.newValue ? JSON.parse(e.newValue) : initialValue;
        setStoredValue(newVal);
      } catch (err) {
        // ignore
      }
    }

    function handleCustomEvent(e: Event) {
      // custom event detail has key and value
      try {
        // @ts-ignore
        const detail = e?.detail;
        if (!detail || detail.key !== key) return;
        setStoredValue(detail.value as T);
      } catch (err) {
        // ignore
      }
    }

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('local-storage', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('local-storage', handleCustomEvent as EventListener);
    };
  }, [key, initialValue]);

  return [storedValue, setValue] as const;
}