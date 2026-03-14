import { useState, useCallback } from 'react';

export interface FileSystemContextType {
  directoryHandle: FileSystemDirectoryHandle | null;
  selectDirectory: () => Promise<void>;
  error: string | null;
}

export function useFileSystem() {
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectDirectory = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite', // Application needs write access for user_db? 
        // Specification says "user input ... save to user_db.json". Yes.
        // startIn: 'desktop', // Removed explicit startIn so it remembers the last used directory or uses the app's context
      });
      setDirectoryHandle(handle);
      setError(null);
    } catch (err: any) {
      console.error("Error selecting directory:", err);
      // User cancellation is not really an error to display aggressively
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to open directory');
      }
    }
  }, []);

  return { directoryHandle, selectDirectory, error };
}
