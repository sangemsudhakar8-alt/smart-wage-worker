import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { fetchGeoFenceHistory } from '../api';

/**
 * Renders the historical timeline logs of geofencing status for an attendance record.
 * Used by employers to audit worker location metrics.
 * 
 * @param {object} props
 * @param {string} props.attendanceId - Selected worker attendance session ID
 */
const GeoFenceHistoryList = ({ attendanceId }) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadLogs = async () => {
            if (!attendanceId) return;
            setLoading(true);
            setError(null);
            try {
                const data = await fetchGeoFenceHistory(attendanceId);
                setLogs(data || []);
            } catch (err) {
                console.error('[GeoFenceHistoryList] Failed to load history:', err);
                setError(t('history_load_failed') || 'Failed to load location history.');
            } finally {
                setLoading(false);
            }
        };

        loadLogs();
    }, [attendanceId, t]);

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)' }}>
                <span className="spinner" style={{ display: 'inline-block', marginBottom: '8px' }} />
                <div>{t('loading_history') || 'Loading tracking log timeline...'}</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ border: '1px solid #ef4444', background: 'rgba(239,68,68,0.05)', padding: '1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} />
                <span>{error}</span>
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)', border: '1.5px dashed var(--border-color)', borderRadius: '16px' }}>
                <Clock size={36} style={{ opacity: 0.5, marginBottom: '10px' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>{t('no_location_logs') || 'No location reports logged for this shift.'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', opacity: 0.8 }}>{t('no_logs_detail') || 'Tracking metrics will appear once active geo-fencing checks begin.'}</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📍 {t('zone_log_history') || 'Location Timeline'}
                <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    {logs.length} {t('reports') || 'reports'}
                </span>
            </h4>

            <div style={{
                maxHeight: '280px',
                overflowY: 'auto',
                paddingRight: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '12px',
                background: 'var(--bg-light)'
            }}>
                {logs.map((log) => {
                    const timeStr = log.timestamp
                        ? new Date(log.timestamp._seconds * 1000 || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'N/A';

                    return (
                        <div 
                            key={log.id} 
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: 'var(--card-bg)',
                                border: '1.5px solid var(--card-border)',
                                fontSize: '0.75rem',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ 
                                    color: log.insideRadius ? '#10b981' : '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    {log.insideRadius ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                                </div>
                                <div>
                                    <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                                        {log.insideRadius ? t('in_zone') || 'In Zone' : t('out_of_zone') || 'Out of Zone'}
                                    </span>
                                    <span style={{ color: 'var(--text-light)', marginLeft: '6px' }}>
                                        ({Math.round(log.distance)}m away)
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)' }}>
                                <span style={{ fontFamily: 'monospace' }}>
                                    {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                                </span>
                                <span style={{ fontWeight: 600, fontSize: '0.7rem', opacity: 0.8 }}>
                                    {timeStr}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GeoFenceHistoryList;
