/**
 * Network Status Detection
 * Monitors connectivity and provides real-time network state
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export interface NetworkState {
  status: NetworkStatus;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  details: NetInfoState | null;
}

type NetworkListener = (state: NetworkState) => void;

/**
 * Network Monitor class
 * Manages network state subscriptions and provides connectivity info
 */
class NetworkMonitor {
  private currentState: NetworkState = {
    status: 'unknown',
    isConnected: true,
    isInternetReachable: null,
    type: 'unknown',
    details: null,
  };
  
  private listeners: Set<NetworkListener> = new Set();
  private subscription: NetInfoSubscription | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the network monitor
   * Should be called once at app startup
   */
  async initialize(): Promise<NetworkState> {
    if (this.initialized) {
      return this.currentState;
    }

    try {
      // Get initial state
      const state = await NetInfo.fetch();
      this.updateState(state);
      
      // Subscribe to changes
      this.subscription = NetInfo.addEventListener(this.handleNetworkChange);
      
      this.initialized = true;
      console.log('[NetworkMonitor] Initialized:', this.currentState.status);
      
      return this.currentState;
    } catch (error) {
      console.error('[NetworkMonitor] Initialization error:', error);
      // Default to online if we can't determine
      this.currentState = {
        status: 'online',
        isConnected: true,
        isInternetReachable: true,
        type: 'unknown',
        details: null,
      };
      return this.currentState;
    }
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange = (state: NetInfoState): void => {
    this.updateState(state);
    this.notifyListeners();
  };

  /**
   * Update internal state from NetInfo state
   */
  private updateState(state: NetInfoState): void {
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable;
    
    // Consider offline if explicitly not connected or internet not reachable
    const status: NetworkStatus = 
      !isConnected ? 'offline' :
      isInternetReachable === false ? 'offline' :
      isInternetReachable === null ? 'unknown' :
      'online';

    this.currentState = {
      status,
      isConnected,
      isInternetReachable,
      type: state.type,
      details: state,
    };

    console.log('[NetworkMonitor] State changed:', status, state.type);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('[NetworkMonitor] Listener error:', error);
      }
    });
  }

  /**
   * Get current network state
   */
  getState(): NetworkState {
    return this.currentState;
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.currentState.status === 'online';
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.currentState.status === 'offline';
  }

  /**
   * Subscribe to network changes
   * Returns unsubscribe function
   */
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    
    // Immediately call with current state
    listener(this.currentState);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Force refresh network state
   */
  async refresh(): Promise<NetworkState> {
    try {
      const state = await NetInfo.fetch();
      this.updateState(state);
      this.notifyListeners();
      return this.currentState;
    } catch (error) {
      console.error('[NetworkMonitor] Refresh error:', error);
      return this.currentState;
    }
  }

  /**
   * Wait for network to become available
   * Returns true if online, false if timeout
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    if (this.isOnline()) {
      return true;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.subscribe((state) => {
        if (state.status === 'online') {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  /**
   * Cleanup subscriptions
   */
  cleanup(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

// Export singleton instance
export const networkMonitor = new NetworkMonitor();

/**
 * Hook-friendly helper to get current online status
 */
export function getNetworkStatus(): NetworkStatus {
  return networkMonitor.getState().status;
}

/**
 * Quick check if online
 */
export function isOnline(): boolean {
  return networkMonitor.isOnline();
}
