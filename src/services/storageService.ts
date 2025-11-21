import { ArcGISService } from '../types/arcgis.types';
import { AuthService } from './authService';

export interface HistoryEntry {
  url: string;
  timestamp: number;
  label?: string;
}

export interface Favorite {
  id: string;
  service: ArcGISService;
  timestamp: number;
  notes?: string;
}

export class StorageService {
  private static readonly HISTORY_KEY = 'arcgis-explorer-history';
  private static readonly FAVORITES_KEY = 'arcgis-explorer-favorites';
  private static readonly MAX_HISTORY_SIZE = 20;

  // History Management
  static getHistory(): HistoryEntry[] {
    try {
      const data = localStorage.getItem(this.HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }

  static addToHistory(url: string, label?: string): void {
    try {
      const history = this.getHistory();

      // Remove existing entry if present
      const filtered = history.filter((entry) => entry.url !== url);

      // Add new entry at the beginning
      const newHistory: HistoryEntry[] = [
        { url, timestamp: Date.now(), label },
        ...filtered,
      ].slice(0, this.MAX_HISTORY_SIZE);

      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }

  static removeFromHistory(url: string): void {
    try {
      const history = this.getHistory();
      const filtered = history.filter((entry) => entry.url !== url);
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing from history:', error);
    }
  }

  static clearHistory(): void {
    try {
      localStorage.removeItem(this.HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }

  // Favorites Management
  static getFavorites(): Favorite[] {
    try {
      const data = localStorage.getItem(this.FAVORITES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading favorites:', error);
      return [];
    }
  }

  static addFavorite(service: ArcGISService, notes?: string): void {
    try {
      const favorites = this.getFavorites();
      const id = this.generateFavoriteId(service);

      // Check if already exists
      const exists = favorites.some((fav) => fav.id === id);
      if (exists) {
        return;
      }

      const newFavorite: Favorite = {
        id,
        service,
        timestamp: Date.now(),
        notes,
      };

      favorites.push(newFavorite);
      localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Error adding favorite:', error);
    }
  }

  static removeFavorite(id: string): void {
    try {
      const favorites = this.getFavorites();
      const filtered = favorites.filter((fav) => fav.id !== id);
      localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  }

  static isFavorite(service: ArcGISService): boolean {
    try {
      const favorites = this.getFavorites();
      const id = this.generateFavoriteId(service);
      return favorites.some((fav) => fav.id === id);
    } catch (error) {
      console.error('Error checking favorite:', error);
      return false;
    }
  }

  static updateFavoriteNotes(id: string, notes: string): void {
    try {
      const favorites = this.getFavorites();
      const favorite = favorites.find((fav) => fav.id === id);

      if (favorite) {
        favorite.notes = notes;
        localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
      }
    } catch (error) {
      console.error('Error updating favorite notes:', error);
    }
  }

  static clearFavorites(): void {
    try {
      localStorage.removeItem(this.FAVORITES_KEY);
    } catch (error) {
      console.error('Error clearing favorites:', error);
    }
  }

  private static generateFavoriteId(service: ArcGISService): string {
    return `${service.url}`;
  }

  // Export/Import functionality
  static exportData(): string {
    const data = {
      history: this.getHistory(),
      favorites: this.getFavorites(),
      tokens: AuthService.getAllTokens(),
      timestamp: Date.now(),
      version: '1.0',
    };
    return JSON.stringify(data, null, 2);
  }

  static importData(jsonString: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonString);

      if (data.history) {
        localStorage.setItem(this.HISTORY_KEY, JSON.stringify(data.history));
      }

      if (data.favorites) {
        localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(data.favorites));
      }

      // Import tokens if present
      if (data.tokens) {
        Object.entries(data.tokens).forEach(([serverUrl, token]) => {
          AuthService.saveToken(serverUrl, token as string);
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Import failed',
      };
    }
  }
}
