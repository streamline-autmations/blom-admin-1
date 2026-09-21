import { createContext, useContext, useState, useEffect } from 'react';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [counts, setCounts] = useState({
    orders: 0,
    course_bookings: 0,
    messages: 0,
    reviews: 0
  });

  // Helper to get local timestamp or default to epoch
  const getLastChecked = (key) => {
    return localStorage.getItem(`last_checked_${key}`) || '1970-01-01T00:00:00.000Z';
  };

  const updateCounts = async () => {
    try {
      const lastOrders = getLastChecked('orders');
      const lastBookings = getLastChecked('course_bookings');
      const lastMessages = getLastChecked('messages');
      const lastReviews = getLastChecked('reviews');

      const qs = new URLSearchParams({
        last_orders: lastOrders,
        last_course_bookings: lastBookings,
        last_messages: lastMessages,
        last_reviews: lastReviews,
      });

      const res = await fetch(`/.netlify/functions/admin-notification-counts?${qs.toString()}`);
      if (!res.ok) {
        throw new Error(`Counts HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (!json?.ok) {
        throw new Error(json?.error || 'Failed to load notification counts');
      }

      const newCounts = {
        orders: json.counts?.orders || 0,
        course_bookings: json.counts?.course_bookings || 0,
        messages: json.counts?.messages || 0,
        reviews: json.counts?.reviews || 0,
      };

      setCounts(newCounts);
    } catch (err) {
      console.error('Error fetching notification counts:', err);
    }
  };

  // Update counts on mount and every minute
  useEffect(() => {
    updateCounts();
    const interval = setInterval(updateCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = (section) => {
    // Mark as read for all time-based notifications
    if (['orders', 'course_bookings', 'messages', 'reviews'].includes(section)) {
      const now = new Date().toISOString();
      localStorage.setItem(`last_checked_${section}`, now);
      // Optimistically clear count
      setCounts(prev => ({ ...prev, [section]: 0 }));
    }
  };

  return (
    <NotificationContext.Provider value={{ counts, markAsRead, refreshNotifications: updateCounts }}>
      {children}
    </NotificationContext.Provider>
  );
}
