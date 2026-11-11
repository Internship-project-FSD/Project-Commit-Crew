import { Bell, ChevronDown, Clock3, LogOut, X, AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDateTime, initials } from '../utils/format.js';

function readStoredNotificationIds(storageKey) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function NotificationIcon({ status }) {
  if (status === 'failed') return <AlertTriangle size={17} />;
  if (status === 'running' || status === 'queued') return <LoaderCircle size={17} />;
  if (status === 'success') return <CheckCircle2 size={17} />;
  return <AlertTriangle size={17} />;
}

export default function Topbar({ user, onLogout, onRunNow, canRun, health, demoMode, notifications = [], onOpenNotification, onViewAllRuns }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);
  const notificationStorageKey = `dms_dashboard_read_notifications:${encodeURIComponent(String(user?.id || user?.email || 'dashboard-user'))}`;
  const [readNotificationIds, setReadNotificationIds] = useState(() => readStoredNotificationIds(notificationStorageKey));

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    function handlePointerDown(event) {
      if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setNotificationsOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    setReadNotificationIds(readStoredNotificationIds(notificationStorageKey));
  }, [notificationStorageKey]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === notificationStorageKey) {
        setReadNotificationIds(readStoredNotificationIds(notificationStorageKey));
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [notificationStorageKey]);

  const readIds = new Set(readNotificationIds);
  const unreadNotifications = notifications.filter((item) => !readIds.has(String(item.id)));
  const notificationCount = unreadNotifications.length;

  function markNotificationRead(notificationId) {
    const id = String(notificationId);
    if (readIds.has(id)) return;
    const nextIds = [...readIds, id].slice(-500);
    try { window.localStorage.setItem(notificationStorageKey, JSON.stringify(nextIds)); } catch { /* Read state still updates for this session when storage is unavailable. */ }
    setReadNotificationIds(nextIds);
  }

  function markAllNotificationsRead() {
    const nextIds = [...new Set([...readNotificationIds, ...notifications.map((item) => String(item.id))])].slice(-500);
    try { window.localStorage.setItem(notificationStorageKey, JSON.stringify(nextIds)); } catch { /* Read state still updates for this session when storage is unavailable. */ }
    setReadNotificationIds(nextIds);
  }

  return (
    <header className="topbar">
      <div className="topbar-left"><span className="breadcrumb-muted">DMS Operations</span><span className="breadcrumb-separator">/</span><strong>Automation dashboard</strong></div>
      <div className="topbar-actions">
        <div className={`connection-pill ${health?.ok ? 'connection-ok' : 'connection-off'}`}><span />{health?.ok ? 'API connected' : 'API unavailable'}</div>
        {demoMode && <span className="demo-label">DEMO</span>}
        <div className="notification-wrap" ref={notificationRef}>
          <button
            type="button"
            className={`icon-button notification-button ${notificationsOpen ? 'notification-active' : ''}`}
            aria-label={notificationCount ? `Notifications, ${notificationCount} unread` : 'Notifications, no unread messages'}
            aria-expanded={notificationsOpen}
            aria-controls="notification-panel"
            aria-live="polite"
            title={`${notificationCount} unread notifications`}
            onClick={() => { setNotificationsOpen((value) => !value); setMenuOpen(false); }}
          >
            <Bell size={17} />
            {notificationCount > 0 && <span className="notification-count">{notificationCount}</span>}
          </button>
          {notificationsOpen && (
            <section className="notification-panel" id="notification-panel" aria-label="Notifications">
              <div className="notification-panel-head">
                <div><strong>Notifications</strong><span>{notificationCount ? `${notificationCount} unread of ${notifications.length}` : notifications.length ? 'All caught up' : 'No recent notifications'}</span></div>
                <div className="notification-panel-head-actions">
                  {notificationCount > 0 && <button type="button" className="notification-mark-all" onClick={markAllNotificationsRead}>Mark all as read</button>}
                  <button type="button" className="notification-close" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}><X size={17} /></button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="notification-empty"><CheckCircle2 size={23} /><strong>You’re all caught up</strong><span>No recent run notifications.</span></div>
              ) : (
                <div className="notification-list">
                  {notifications.map((item) => {
                    const isRead = readIds.has(String(item.id));
                    return <button
                      type="button"
                      className={`notification-item notification-${item.status} ${isRead ? 'notification-read' : 'notification-unread'}`}
                      key={item.id}
                      onClick={() => { markNotificationRead(item.id); setNotificationsOpen(false); onOpenNotification?.(item); }}
                    >
                      <span className="notification-item-icon"><NotificationIcon status={item.status} /></span>
                      <span className="notification-item-copy">
                        <strong>{item.title}</strong>
                        <span>{item.message}</span>
                        <small><Clock3 size={12} />{formatDateTime(item.startedAt)} <b>·</b> {item.runId}</small>
                      </span>
                      <span className="notification-item-state">{isRead ? 'Read' : <span className="notification-unread-dot" aria-label="Unread" />}</span>
                      <span className="notification-item-arrow" aria-hidden="true">›</span>
                    </button>;
                  })}
                </div>
              )}
              <div className="notification-panel-foot"><button type="button" onClick={() => { setNotificationsOpen(false); onViewAllRuns?.(); }}>View all runs</button></div>
            </section>
          )}
        </div>
        {canRun && <button type="button" className="button button-primary top-run-button" onClick={onRunNow}><span className="button-plus">+</span> Run now</button>}
        <div className="profile-wrap">
          <button type="button" className="profile-trigger" onClick={() => { setMenuOpen((v) => !v); setNotificationsOpen(false); }} aria-expanded={menuOpen}>
            <div className="avatar">{initials(user)}</div><div className="profile-copy"><strong>{user?.name || 'User'}</strong><span>{user?.role === 'admin' ? 'Administrator' : 'Manager'}</span></div><ChevronDown size={15} />
          </button>
          {menuOpen && <div className="profile-menu"><div className="profile-menu-header"><strong>{user?.name}</strong><span>{user?.email}</span></div><button type="button" onClick={() => { setMenuOpen(false); onLogout(); }}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </div>
    </header>
  );
}
