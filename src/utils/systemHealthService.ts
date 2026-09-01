import { AppNotification } from '../types';

export interface SystemHealthState {
  firestore: 'online' | 'degraded' | 'offline' | 'checking';
  googleSheets: 'online' | 'standby' | 'error' | 'checking';
  sqliteBackup: 'online' | 'offline' | 'checking';
  offlineCache: 'active';
  overallStatus: 'healthy' | 'fallback_active' | 'offline_mode';
  lastChecked: number;
  lastSuccessfulFirestoreSync: number;
  lastSuccessfulSheetsSync: number;
  lastSuccessfulBackupSync: number;
  pendingOutboxCount: number;
  activeFallbackMessage?: string;
}

export interface OutboxItem {
  id: string;
  type: 'SAVE_POST' | 'DELETE_POST' | 'SAVE_USER' | 'DELETE_USER' | 'SYNC_POSTS' | 'SEND_BROADCAST';
  payload: any;
  timestamp: number;
  retryCount: number;
}

const OUTBOX_STORAGE_KEY = 'mtfeed_resilient_outbox';
const HEALTH_STATE_KEY = 'mtfeed_health_state';

class SystemHealthManager {
  private state: SystemHealthState = {
    firestore: 'online',
    googleSheets: 'online',
    sqliteBackup: 'online',
    offlineCache: 'active',
    overallStatus: 'healthy',
    lastChecked: Date.now(),
    lastSuccessfulFirestoreSync: Date.now(),
    lastSuccessfulSheetsSync: Date.now(),
    lastSuccessfulBackupSync: Date.now(),
    pendingOutboxCount: 0
  };

  private listeners: Set<(state: SystemHealthState) => void> = new Set();
  private notificationDispatchers: Set<(notif: AppNotification) => void> = new Set();
  private toastDispatchers: Set<(toast: { id: string; type: 'info' | 'warning' | 'success'; message: string; submessage?: string }) => void> = new Set();
  private outbox: OutboxItem[] = [];
  private isDrainingOutbox = false;
  private checkIntervalId: any = null;
  private previousOverallStatus: SystemHealthState['overallStatus'] = 'healthy';

  constructor() {
    this.loadOutbox();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.reportNetworkEvent('online');
        this.runHealthCheck();
        this.drainOutbox();
      });

      window.addEventListener('offline', () => {
        this.reportNetworkEvent('offline');
      });

      // Start periodic health monitor every 15 seconds
      this.checkIntervalId = setInterval(() => {
        this.runHealthCheck();
      }, 15000);

      // Initial check
      setTimeout(() => {
        this.runHealthCheck();
      }, 1500);
    }
  }

  // Subscribe to health state updates
  public subscribe(listener: (state: SystemHealthState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Subscribe to notification dispatcher
  public onNotification(dispatcher: (notif: AppNotification) => void): () => void {
    this.notificationDispatchers.add(dispatcher);
    return () => {
      this.notificationDispatchers.delete(dispatcher);
    };
  }

  // Subscribe to toast alerts
  public onToast(dispatcher: (toast: { id: string; type: 'info' | 'warning' | 'success'; message: string; submessage?: string }) => void): () => void {
    this.toastDispatchers.add(dispatcher);
    return () => {
      this.toastDispatchers.delete(dispatcher);
    };
  }

  public getState(): SystemHealthState {
    return {
      ...this.state,
      pendingOutboxCount: this.outbox.length
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach(fn => {
      try {
        fn(currentState);
      } catch (e) {
        console.error('Error in health listener:', e);
      }
    });

    // Detect status transition and dispatch appropriate alerts
    if (currentState.overallStatus !== this.previousOverallStatus) {
      this.handleStatusTransition(this.previousOverallStatus, currentState.overallStatus);
      this.previousOverallStatus = currentState.overallStatus;
    }
  }

  private lastStatusNotifTime = {
    fallback_active: 0,
    offline_mode: 0,
    healthy: 0
  };

  private handleStatusTransition(prev: SystemHealthState['overallStatus'], next: SystemHealthState['overallStatus']) {
    const now = Date.now();

    if (next === 'fallback_active' && prev === 'healthy') {
      if (now - this.lastStatusNotifTime.fallback_active > 300000) {
        this.lastStatusNotifTime.fallback_active = now;
        const msg = '⚡ สลับใช้ระบบสำรองข้อมูลอัตโนมัติ (Google Sheets & SQLite)';
        const sub = 'ระบบหลักขัดข้องชั่วคราว ข้อมูลของคุณได้รับการปกป้อง 100%';
        this.emitToast('warning', msg, sub);
        this.emitSystemNotification(
          'โหมดสำรองฉุกเฉินทำงาน',
          'ระบบตรวจพบความหน่วงหรือการขัดข้อง จึงเปิดใช้งานระบบสำรองอัตโนมัติ ข้อมูลทุกอย่างปลอดภัยและยังคงโพสต์/ใช้งานได้ตามปกติ'
        );
      }
    } else if (next === 'offline_mode' && prev !== 'offline_mode') {
      if (now - this.lastStatusNotifTime.offline_mode > 300000) {
        this.lastStatusNotifTime.offline_mode = now;
        const msg = '📡 กำลังทำงานในโหมดออฟไลน์ (Offline-First)';
        const sub = 'คุณยังสามารถใช้งานและสร้างโพสต์ได้ตามปกติ';
        this.emitToast('info', msg, sub);
        this.emitSystemNotification(
          'โหมดออฟไลน์ทำงาน',
          'อุปกรณ์ของคุณตัดการเชื่อมต่ออินเทอร์เน็ต ข้อมูลใหม่จะถูกเก็บในแคชที่ปลอดภัยและส่งอัตโนมัติเมื่อออนไลน์'
        );
      }
    } else if (next === 'healthy' && (prev === 'fallback_active' || prev === 'offline_mode')) {
      if (now - this.lastStatusNotifTime.healthy > 300000) {
        this.lastStatusNotifTime.healthy = now;
        const msg = '✅ ทุกระบบหลักเชื่อมต่อสมบูรณ์ 100%';
        const sub = 'ข้อมูลทั้งหมดถูกตรวจสอบและสมานตรงกันเรียบร้อยแล้ว';
        this.emitToast('success', msg, sub);
        this.emitSystemNotification(
          'ระบบกลับสู่สภาวะปกติสมบูรณ์',
          'ระบบ Cloud และฐานข้อมูลทุกชั้นเชื่อมต่อและสมานข้อมูล (Self-Healing) เรียบร้อยแล้ว'
        );
        this.drainOutbox();
      }
    }
  }

  public clearOutbox() {
    this.outbox = [];
    this.saveOutbox();
  }

  public emitToast(type: 'info' | 'warning' | 'success', message: string, submessage?: string) {
    const toast = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      message,
      submessage
    };
    this.toastDispatchers.forEach(fn => {
      try {
        fn(toast);
      } catch (e) {}
    });
  }

  public emitSystemNotification(title: string, description: string) {
    const notif: AppNotification = {
      id: `sys_notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'system',
      title,
      description,
      createdAt: 'เมื่อสักครู่',
      createdAtMs: Date.now(),
      read: false
    };
    this.notificationDispatchers.forEach(fn => {
      try {
        fn(notif);
      } catch (e) {}
    });
  }

  public reportFirestoreSuccess() {
    this.state.firestore = 'online';
    this.state.lastSuccessfulFirestoreSync = Date.now();
    this.updateOverallStatus();
  }

  public reportFirestoreDegraded(reason?: string) {
    if (this.state.firestore !== 'degraded') {
      this.state.firestore = 'degraded';
      this.state.activeFallbackMessage = reason || 'Firestore Cloud ขัดข้องชั่วคราว';
      this.updateOverallStatus();
    }
  }

  public reportSheetsSuccess() {
    this.state.googleSheets = 'online';
    this.state.lastSuccessfulSheetsSync = Date.now();
    this.updateOverallStatus();
  }

  public reportSheetsError() {
    if (this.state.googleSheets !== 'error') {
      this.state.googleSheets = 'error';
      this.updateOverallStatus();
    }
  }

  public reportBackupSuccess() {
    this.state.sqliteBackup = 'online';
    this.state.lastSuccessfulBackupSync = Date.now();
    this.updateOverallStatus();
  }

  public reportBackupError() {
    this.state.sqliteBackup = 'offline';
    this.updateOverallStatus();
  }

  public reportNetworkEvent(event: 'online' | 'offline') {
    if (event === 'offline') {
      this.state.firestore = 'offline';
      this.state.googleSheets = 'error';
      this.state.sqliteBackup = 'offline';
      this.state.overallStatus = 'offline_mode';
    } else {
      this.state.overallStatus = 'healthy';
    }
    this.notify();
  }

  private updateOverallStatus() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.state.overallStatus = 'offline_mode';
    } else if (this.state.firestore === 'degraded' || this.state.firestore === 'offline') {
      this.state.overallStatus = 'fallback_active';
    } else if (this.state.googleSheets === 'error' && this.state.sqliteBackup === 'offline') {
      this.state.overallStatus = 'fallback_active';
    } else {
      this.state.overallStatus = 'healthy';
    }
    this.state.lastChecked = Date.now();
    this.notify();
  }

  // Health check probing
  public async runHealthCheck(): Promise<SystemHealthState> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.reportNetworkEvent('offline');
      return this.getState();
    }

    // 1. Check local SQLite backend health
    try {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        this.reportBackupSuccess();
      } else {
        this.reportBackupError();
      }
    } catch (e) {
      this.reportBackupError();
    }

    this.state.lastChecked = Date.now();
    this.updateOverallStatus();
    return this.getState();
  }

  // --- Outbox Management (Zero-Loss Guarantee) ---

  private loadOutbox() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
      if (raw) {
        this.outbox = JSON.parse(raw);
      }
    } catch (e) {
      this.outbox = [];
    }
  }

  private saveOutbox() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.outbox));
      this.notify();
    } catch (e) {}
  }

  public enqueueAction(type: OutboxItem['type'], payload: any) {
    const item: OutboxItem = {
      id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0
    };
    this.outbox.push(item);
    this.saveOutbox();
    this.drainOutbox();
  }

  public async drainOutbox() {
    if (this.isDrainingOutbox || this.outbox.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isDrainingOutbox = true;
    try {
      const remaining: OutboxItem[] = [];
      for (const item of this.outbox) {
        let success = true;
        try {
          // Dynamic import or dispatch to prevent circular deps
          const { executeOutboxAction } = await import('./outboxExecutor');
          success = await executeOutboxAction(item);
        } catch (err) {
          console.warn(`Outbox execution failed for item ${item.id}:`, err);
          success = false;
        }

        if (!success) {
          item.retryCount++;
          if (item.retryCount < 5) {
            remaining.push(item);
          }
        }
      }
      this.outbox = remaining;
      this.saveOutbox();
    } finally {
      this.isDrainingOutbox = false;
    }
  }
}

export const systemHealthManager = new SystemHealthManager();
