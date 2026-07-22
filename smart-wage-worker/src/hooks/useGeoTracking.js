import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';
import { playAudio } from '../utils/audio';
import { calculateDistance } from '../utils/geoUtils';
import { startGeoFence, updateGeoFenceLocation, updateLiveLocation } from '../api';

/**
 * Custom hook to orchestrate Geolocation watch position, active geofencing updates to API,
 * background polling throttling, and error recovery.
 * 
 * @param {boolean} active - Whether geofencing tracking is currently active
 * @param {string} attendanceId - Active attendance record ID
 * @param {string} jobId - Associated job ID
 * @param {object} job - Associated job details for client-side distance fallbacks
 * @param {string} userId - Current authenticated worker user ID
 * @returns {{ currentDistance: number|null, geofenceStatus: string|null, violationCount: number, locationError: string|null }}
 */
export const useGeoTracking = (active, attendanceId, jobId, job, userId) => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();

    const [currentDistance, setCurrentDistance] = useState(null);
    const [geofenceStatus, setGeofenceStatus] = useState(null);
    const [violationCount, setViolationCount] = useState(0);
    const [locationError, setLocationError] = useState(null);

    const watchIdRef = useRef(null);
    const geoFenceIntervalRef = useRef(null);
    const geofenceStartedRef = useRef(false);

    useEffect(() => {
        const sendLocationUpdate = async (isFirstCall = false) => {
            if (!navigator.geolocation) {
                setLocationError("Geolocation is not supported by this browser.");
                return;
            }

            return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const { latitude, longitude } = pos.coords;
                        setLocationError(null);

                        // Update live marker location on server
                        await updateLiveLocation(userId, { lat: latitude, lng: longitude }).catch(() => {});

                        try {
                            let result;
                            if (isFirstCall && !geofenceStartedRef.current) {
                                result = await startGeoFence({ attendanceId, jobId, latitude, longitude });
                                geofenceStartedRef.current = true;
                            } else {
                                result = await updateGeoFenceLocation({ attendanceId, latitude, longitude });
                            }

                            if (result) {
                                setCurrentDistance(result.distance);
                                setGeofenceStatus(result.status);
                                setViolationCount(result.violationCount ?? 0);

                                // Fire status notifications on transitions
                                if (!result.insideRadius && result.transition === 'exited') {
                                    showToast(`⚠️ ${t('out_of_zone')} (${Math.round(result.distance)} m)`, 'error');
                                    playAudio(t('out_of_zone'), i18n.language);
                                } else if (result.insideRadius && result.transition === 'entered') {
                                    showToast(`✅ ${t('back_in_zone') || 'You are back in the work zone.'}`, 'success');
                                }
                            }
                        } catch (apiErr) {
                            console.warn('[GeoFence Hook] API sync failed, running client fallback:', apiErr.message);
                            if (job?.lat && job?.lng) {
                                const dist = calculateDistance(latitude, longitude, job.lat, job.lng);
                                const radius = job.radius || 100;
                                setCurrentDistance(dist);
                                setGeofenceStatus(dist <= radius ? 'Active' : 'Outside Radius');
                            }
                        }
                        resolve();
                    },
                    (err) => {
                        if (err.code === 1) {
                            setLocationError(t('gps_denied'));
                        } else {
                            console.error('[GeoFence Hook] GPS fetch error:', err);
                        }
                        resolve();
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
                );
            });
        };

        if (active && jobId && attendanceId) {
            // Immediate verification on launch
            sendLocationUpdate(true);

            // Periodic updates every 30 seconds
            geoFenceIntervalRef.current = setInterval(() => {
                sendLocationUpdate(false);
            }, 30_000);

            // High accuracy watch position updates the live map marker without hitting the REST endpoint continuously
            watchIdRef.current = navigator.geolocation.watchPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    await updateLiveLocation(userId, { lat: latitude, lng: longitude }).catch(() => {});
                    
                    if (job?.lat && job?.lng) {
                        const dist = calculateDistance(latitude, longitude, job.lat, job.lng);
                        setCurrentDistance(dist);
                    }
                },
                (err) => {
                    if (err.code === 1) setLocationError(t('gps_denied'));
                },
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
            );
        }

        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            if (geoFenceIntervalRef.current) {
                clearInterval(geoFenceIntervalRef.current);
                geoFenceIntervalRef.current = null;
            }
            geofenceStartedRef.current = false;
        };
    }, [active, attendanceId, jobId, job, userId, t, i18n.language, showToast]);

    return { currentDistance, geofenceStatus, violationCount, locationError };
};
