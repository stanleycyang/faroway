/**
 * Offline Storage Manager
 * Uses AsyncStorage for persistent local data storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trip, TripInput } from '../../stores/tripStore';

// Storage keys
const STORAGE_KEYS = {
  TRIPS: '@tripgenie/trips',
  PENDING_MUTATIONS: '@tripgenie/pending_mutations',
  LAST_SYNC: '@tripgenie/last_sync',
  SYNC_META: '@tripgenie/sync_meta',
} as const;

// Mutation types for offline queue
export type MutationType = 'create' | 'update' | 'delete';

export interface PendingMutation {
  id: string;
  type: MutationType;
  tripId: string;
  data?: Partial<TripInput> | TripInput;
  timestamp: number;
  retryCount: number;
}

export interface SyncMeta {
  lastSyncTime: number | null;
  lastSyncStatus: 'success' | 'partial' | 'failed' | null;
  pendingCount: number;
}

/**
 * Storage class for managing offline trip data
 */
class OfflineStorage {
  // ==================== TRIPS ====================

  /**
   * Save all trips to local storage
   */
  async saveTrips(trips: Trip[]): Promise<void> {
    try {
      const data = JSON.stringify(trips);
      await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, data);
    } catch (error) {
      console.error('[OfflineStorage] Error saving trips:', error);
      throw error;
    }
  }

  /**
   * Load all trips from local storage
   */
  async loadTrips(): Promise<Trip[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TRIPS);
      if (!data) return [];
      return JSON.parse(data) as Trip[];
    } catch (error) {
      console.error('[OfflineStorage] Error loading trips:', error);
      return [];
    }
  }

  /**
   * Save a single trip (upsert)
   */
  async saveTrip(trip: Trip): Promise<void> {
    try {
      const trips = await this.loadTrips();
      const existingIndex = trips.findIndex(t => t.id === trip.id);
      
      if (existingIndex >= 0) {
        trips[existingIndex] = trip;
      } else {
        trips.unshift(trip);
      }
      
      await this.saveTrips(trips);
    } catch (error) {
      console.error('[OfflineStorage] Error saving trip:', error);
      throw error;
    }
  }

  /**
   * Delete a trip from local storage
   */
  async deleteTrip(tripId: string): Promise<void> {
    try {
      const trips = await this.loadTrips();
      const filtered = trips.filter(t => t.id !== tripId);
      await this.saveTrips(filtered);
    } catch (error) {
      console.error('[OfflineStorage] Error deleting trip:', error);
      throw error;
    }
  }

  /**
   * Get a single trip by ID
   */
  async getTrip(tripId: string): Promise<Trip | null> {
    try {
      const trips = await this.loadTrips();
      return trips.find(t => t.id === tripId) || null;
    } catch (error) {
      console.error('[OfflineStorage] Error getting trip:', error);
      return null;
    }
  }

  // ==================== PENDING MUTATIONS ====================

  /**
   * Add a mutation to the offline queue
   */
  async addPendingMutation(mutation: Omit<PendingMutation, 'id' | 'timestamp' | 'retryCount'>): Promise<PendingMutation> {
    try {
      const mutations = await this.getPendingMutations();
      
      // Check if there's already a pending mutation for this trip
      const existingIndex = mutations.findIndex(m => m.tripId === mutation.tripId);
      
      const newMutation: PendingMutation = {
        ...mutation,
        id: `mutation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };

      // If there's an existing mutation, handle conflicts
      if (existingIndex >= 0) {
        const existing = mutations[existingIndex];
        
        // Delete supersedes everything
        if (mutation.type === 'delete') {
          mutations[existingIndex] = newMutation;
        }
        // Create + Update = Update the created data
        else if (existing.type === 'create' && mutation.type === 'update') {
          mutations[existingIndex] = {
            ...existing,
            data: { ...existing.data, ...mutation.data },
            timestamp: Date.now(),
          };
          return mutations[existingIndex];
        }
        // Update + Update = Merge updates
        else if (existing.type === 'update' && mutation.type === 'update') {
          mutations[existingIndex] = {
            ...existing,
            data: { ...existing.data, ...mutation.data },
            timestamp: Date.now(),
          };
          return mutations[existingIndex];
        }
        // Otherwise replace
        else {
          mutations[existingIndex] = newMutation;
        }
      } else {
        mutations.push(newMutation);
      }

      await this.savePendingMutations(mutations);
      await this.updateSyncMeta({ pendingCount: mutations.length });
      
      return newMutation;
    } catch (error) {
      console.error('[OfflineStorage] Error adding pending mutation:', error);
      throw error;
    }
  }

  /**
   * Get all pending mutations
   */
  async getPendingMutations(): Promise<PendingMutation[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_MUTATIONS);
      if (!data) return [];
      return JSON.parse(data) as PendingMutation[];
    } catch (error) {
      console.error('[OfflineStorage] Error getting pending mutations:', error);
      return [];
    }
  }

  /**
   * Save pending mutations
   */
  async savePendingMutations(mutations: PendingMutation[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_MUTATIONS, JSON.stringify(mutations));
    } catch (error) {
      console.error('[OfflineStorage] Error saving pending mutations:', error);
      throw error;
    }
  }

  /**
   * Remove a mutation from the queue (after successful sync)
   */
  async removePendingMutation(mutationId: string): Promise<void> {
    try {
      const mutations = await this.getPendingMutations();
      const filtered = mutations.filter(m => m.id !== mutationId);
      await this.savePendingMutations(filtered);
      await this.updateSyncMeta({ pendingCount: filtered.length });
    } catch (error) {
      console.error('[OfflineStorage] Error removing pending mutation:', error);
      throw error;
    }
  }

  /**
   * Increment retry count for a mutation
   */
  async incrementMutationRetry(mutationId: string): Promise<void> {
    try {
      const mutations = await this.getPendingMutations();
      const index = mutations.findIndex(m => m.id === mutationId);
      if (index >= 0) {
        mutations[index].retryCount++;
        await this.savePendingMutations(mutations);
      }
    } catch (error) {
      console.error('[OfflineStorage] Error incrementing retry:', error);
    }
  }

  /**
   * Clear all pending mutations (use with caution)
   */
  async clearPendingMutations(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_MUTATIONS);
      await this.updateSyncMeta({ pendingCount: 0 });
    } catch (error) {
      console.error('[OfflineStorage] Error clearing pending mutations:', error);
      throw error;
    }
  }

  // ==================== SYNC METADATA ====================

  /**
   * Get sync metadata
   */
  async getSyncMeta(): Promise<SyncMeta> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_META);
      if (!data) {
        return {
          lastSyncTime: null,
          lastSyncStatus: null,
          pendingCount: 0,
        };
      }
      return JSON.parse(data) as SyncMeta;
    } catch (error) {
      console.error('[OfflineStorage] Error getting sync meta:', error);
      return {
        lastSyncTime: null,
        lastSyncStatus: null,
        pendingCount: 0,
      };
    }
  }

  /**
   * Update sync metadata
   */
  async updateSyncMeta(updates: Partial<SyncMeta>): Promise<void> {
    try {
      const current = await this.getSyncMeta();
      const updated = { ...current, ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_META, JSON.stringify(updated));
    } catch (error) {
      console.error('[OfflineStorage] Error updating sync meta:', error);
    }
  }

  /**
   * Record a successful sync
   */
  async recordSuccessfulSync(): Promise<void> {
    await this.updateSyncMeta({
      lastSyncTime: Date.now(),
      lastSyncStatus: 'success',
    });
  }

  /**
   * Record a failed sync
   */
  async recordFailedSync(): Promise<void> {
    await this.updateSyncMeta({
      lastSyncTime: Date.now(),
      lastSyncStatus: 'failed',
    });
  }

  // ==================== UTILITIES ====================

  /**
   * Clear all offline data (for logout/reset)
   */
  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.TRIPS),
        AsyncStorage.removeItem(STORAGE_KEYS.PENDING_MUTATIONS),
        AsyncStorage.removeItem(STORAGE_KEYS.SYNC_META),
        AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
      ]);
    } catch (error) {
      console.error('[OfflineStorage] Error clearing all data:', error);
      throw error;
    }
  }

  /**
   * Get storage stats for debugging
   */
  async getStorageStats(): Promise<{
    tripCount: number;
    pendingMutations: number;
    lastSync: number | null;
  }> {
    const trips = await this.loadTrips();
    const mutations = await this.getPendingMutations();
    const meta = await this.getSyncMeta();
    
    return {
      tripCount: trips.length,
      pendingMutations: mutations.length,
      lastSync: meta.lastSyncTime,
    };
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage();
