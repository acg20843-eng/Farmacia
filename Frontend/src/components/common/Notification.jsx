import { useEffect } from "react";
import "./Notification.css";

export default function Notification({ notification, onClose }) {
  useEffect(() => {
    if (!notification) {
      return undefined;
    }

    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) {
    return null;
  }

  return (
    <div
      className={`app-notification app-notification-${notification.type}`}
      role="status"
      aria-live="polite"
    >
      <span>{notification.message}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar notificación">
        ×
      </button>
    </div>
  );
}
