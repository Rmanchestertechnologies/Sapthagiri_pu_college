import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';

export const AdminNotificationBell = () => {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            setNotifications(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // 30s low-overhead polling
        return () => clearInterval(interval);
    }, []);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleMarkAsRead = async (id) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error('Error marking notification read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('Error marking all read:', err);
        }
    };

    const handleReview = async (notif) => {
        await handleMarkAsRead(notif.id);
        setIsOpen(false);
        if (notif.related_paper_id) {
            navigate(`/admin/dashboard/preview/${notif.related_paper_id}`);
        } else {
            navigate('/admin/dashboard/cbt-exams');
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-gold/30 text-gold transition flex items-center justify-center cursor-pointer"
                title="Notifications"
            >
                <span className="text-base">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border-2 border-gold/40 z-[100] text-gray-800 overflow-hidden animate-fade-in-up">
                    <div className="p-3.5 bg-navy text-white flex justify-between items-center border-b border-gold/20">
                        <div className="flex items-center gap-2">
                            <span className="text-gold text-sm font-black uppercase tracking-wider">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="bg-gold text-navy text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                    {unreadCount} New
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] text-gold/80 hover:text-gold font-bold underline"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-xs font-medium">
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.slice(0, 15).map(n => (
                                <div
                                    key={n.id}
                                    className={`p-3.5 transition flex flex-col gap-1.5 ${n.is_read ? 'bg-white hover:bg-gray-50/80' : 'bg-blue-50/70 hover:bg-blue-50 border-l-4 border-l-gold'}`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-bold text-xs text-navy leading-snug">
                                            {n.title}
                                        </h4>
                                        <span className="text-[9px] text-gray-400 font-semibold whitespace-nowrap">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                                        {n.message}
                                    </p>
                                    <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-gray-100/60">
                                        <span className="text-[9px] text-gray-400 font-semibold">
                                            Teacher: {n.sender_name}
                                        </span>
                                        <button
                                            onClick={() => handleReview(n)}
                                            className="bg-navy hover:bg-gold hover:text-navy text-gold text-[10px] font-black px-3 py-1 rounded-lg transition shadow-xs uppercase tracking-wider flex items-center gap-1"
                                        >
                                            <span>Review Now</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
