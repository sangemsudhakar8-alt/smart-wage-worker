import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { calculateDistance } from '../utils/geoUtils';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom markers
const workerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const jobIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redWorkerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map view adjustments
const MapController = ({ workerLoc, jobLoc, radius }) => {
    const map = useMap();
    
    useEffect(() => {
        if (workerLoc && jobLoc) {
            const bounds = L.latLngBounds([
                [workerLoc.lat, workerLoc.lng],
                [jobLoc.lat, jobLoc.lng]
            ]);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } else if (jobLoc) {
            map.setView([jobLoc.lat, jobLoc.lng], 16);
        }
    }, [workerLoc, jobLoc, map]);

    return null;
};

const TrackingMap = ({ worker, job, radius = 100, onSimulate }) => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language || 'en';
    
    const workerLoc = worker?.currentLocation;
    const jobLoc = { lat: job?.lat, lng: job?.lng };
    
    const distance = useMemo(() => {
        if (!workerLoc || !jobLoc.lat) return null;
        return calculateDistance(jobLoc.lat, jobLoc.lng, workerLoc.lat, workerLoc.lng);
    }, [workerLoc, jobLoc]);

    const isOutOfRange = distance !== null && distance > radius;

    return (
        <div style={{ height: '400px', width: '100%', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
            <div style={{
                position: 'absolute', top: '15px', left: '15px', zIndex: 1000,
                background: isOutOfRange ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
                color: 'white', padding: '10px 20px', borderRadius: '15px',
                backdropFilter: 'blur(10px)', boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column', gap: '2px',
                border: '1px solid rgba(255,255,255,0.2)',
                animation: isOutOfRange ? 'pulse-red 2s infinite' : 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className={isOutOfRange ? "pulse-fast" : "pulse-green"} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {isOutOfRange ? t('out_of_zone') : t('at_worksite') || 'At Worksite'}
                    </span>
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>
                    {distance !== null ? t('distance_from_site', { distance: Math.round(distance) }) : t('locating...')}
                </span>
            </div>

            {/* Demo Simulation Button */}
            {onSimulate && (
                <button 
                    onClick={onSimulate}
                    style={{
                        position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000,
                        background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                        color: 'white', border: 'none', padding: '12px 24px', borderRadius: '30px',
                        fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                        boxShadow: '0 10px 25px rgba(67, 56, 202, 0.4)',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        transition: 'transform 0.2s active'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    ✨ {t('simulate_demo_move')}
                </button>
            )}

            <MapContainer 
                center={[jobLoc.lat || 20.5937, jobLoc.lng || 78.9629]} 
                zoom={16} 
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; Google'
                    url={`https://mt1.google.com/vt/lyrs=m&hl=${currentLang}&x={x}&y={y}&z={z}`}
                />

                {/* Job Location (Center) */}
                {jobLoc.lat && (
                    <>
                        <Marker position={[jobLoc.lat, jobLoc.lng]} icon={jobIcon}>
                            <Popup>
                                <strong>{job.title}</strong><br />
                                {job.location || t('site_center')}
                            </Popup>
                        </Marker>
                        
                        {/* Allowed Radius Circle */}
                        <Circle
                            center={[jobLoc.lat, jobLoc.lng]}
                            radius={radius}
                            pathOptions={{
                                fillColor: isOutOfRange ? '#ef4444' : '#10b981',
                                fillOpacity: 0.2,
                                color: isOutOfRange ? '#ef4444' : '#10b981',
                                weight: 2,
                                dashArray: isOutOfRange ? '5, 5' : 'none'
                            }}
                        />
                    </>
                )}

                {/* Worker Current Location */}
                {(workerLoc || worker?.isPermanentlyOnline) && (
                    <Marker position={[workerLoc?.lat || jobLoc.lat || 17.385, workerLoc?.lng || jobLoc.lng || 78.486]} icon={isOutOfRange ? redWorkerIcon : workerIcon}>
                        <Popup>
                            <div style={{ minWidth: '150px' }}>
                                <strong style={{ color: isOutOfRange ? '#ef4444' : '#059669' }}>{worker.name || 'Worker'}</strong><br />
                                <span style={{ fontSize: '0.8rem' }}>{job?.title}</span><br />
                                {distance !== null && (
                                    <div style={{ marginTop: '5px', fontSize: '0.75rem', fontWeight: 700 }}>
                                        📍 {t('distance_from_site', { distance: Math.round(distance) })}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                                    {worker?.isPermanentlyOnline ? t('working_now') : `${t('last_seen')}: ${workerLoc?.updatedAt ? new Date(workerLoc.updatedAt).toLocaleTimeString() : 'N/A'}`}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                <MapController workerLoc={workerLoc} jobLoc={jobLoc} radius={radius} />
            </MapContainer>
        </div>
    );
};

export default TrackingMap;
