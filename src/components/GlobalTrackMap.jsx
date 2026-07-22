import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { calculateDistance } from '../utils/geoUtils';

// Custom markers (reuse icons from project or define here)
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

// Component to handle map view adjustments for all markers
const MapBoundsController = ({ workers, jobs }) => {
    const map = useMap();
    
    useEffect(() => {
        const bounds = [];
        
        // Add worker locations to bounds
        workers.forEach(w => {
            if (w.currentLocation) {
                bounds.push([w.currentLocation.lat, w.currentLocation.lng]);
            }
        });
        
        // Add job locations to bounds
        jobs.forEach(j => {
            if (j.lat && j.lng) {
                bounds.push([j.lat, j.lng]);
            }
        });
        
        if (bounds.length > 0) {
            const leafletBounds = L.latLngBounds(bounds);
            map.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [workers, jobs, map]);

    return null;
};

const GlobalTrackMap = ({ activeWorkers, applications, jobs, radius = 100 }) => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language || 'en';

    // Filter jobs that are actually being tracked (hired workers)
    const activeJobs = useMemo(() => {
        const hiredJobIds = applications
            .filter(a => a.status === 'selected')
            .map(a => a.jobId);
        return jobs.filter(j => hiredJobIds.includes(j.id));
    }, [applications, jobs]);

    return (
        <div className="card" style={{ height: '450px', width: '100%', borderRadius: '24px', overflow: 'hidden', padding: 0, border: '1.5px solid var(--border-color)', marginBottom: '1.5rem', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            {/* Legend Overlay */}
            <div style={{
                position: 'absolute', top: '15px', right: '15px', zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.9)', padding: '10px 15px', borderRadius: '12px',
                backdropFilter: 'blur(10px)', border: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2563eb' }} />
                    {t('active_workers') || 'Active Workers'} ({activeWorkers.length})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dc2626' }} />
                    {t('job_sites') || 'Job Sites'} ({activeJobs.length})
                </div>
                {/* Visual indicator of scaling radius */}
                <div style={{ fontSize: '0.6rem', color: 'var(--text-light)', borderTop: '1px solid var(--border-color)', marginTop: '4px', paddingTop: '4px' }}>
                    {t('radius') || 'Radius'}: <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{radius}m</span>
                </div>
            </div>

            <MapContainer 
                center={[17.4483, 78.3915]} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; Google'
                    url={`https://mt1.google.com/vt/lyrs=m&hl=${currentLang}&x={x}&y={y}&z={z}`}
                />

                {/* Job Sites */}
                {activeJobs.map(job => (
                    job.lat && (
                        <Marker key={job.id} position={[job.lat, job.lng]} icon={jobIcon}>
                            <Popup>
                                <div style={{ padding: '4px' }}>
                                    <h4 style={{ margin: '0 0 4px' }}>{job.title}</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>📍 {job.location}</p>
                                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#dc2626', fontWeight: 700 }}>{t('site_center') || 'Site Center'}</div>
                                </div>
                            </Popup>
                            <Circle 
                                center={[job.lat, job.lng]} 
                                radius={radius} 
                                pathOptions={{ fillColor: '#dc2626', fillOpacity: 0.1, color: '#dc2626', weight: 1, dashArray: '5,5' }} 
                            />
                        </Marker>
                    )
                ))}

                {/* Active Workers */}
                {activeWorkers.map(worker => {
                    const assignedApp = applications.find(a => a.workerId === worker.id && a.status === 'selected');
                    const assignedJob = jobs.find(j => j.id === assignedApp?.jobId);
                    const dist = assignedJob && worker.currentLocation ? calculateDistance(assignedJob.lat, assignedJob.lng, worker.currentLocation.lat, worker.currentLocation.lng) : null;
                    const isOutOfRange = dist !== null && dist > radius;
                    const isPermanent = worker.isPermanentlyOnline;

                    return (worker.currentLocation || isPermanent) && (
                        <Marker key={worker.id} position={[worker.currentLocation?.lat || 17.4483, worker.currentLocation?.lng || 78.3915]} icon={isOutOfRange ? redWorkerIcon : workerIcon}>
                            <Popup>
                                <div style={{ padding: '4px', minWidth: '160px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <div style={{ 
                                            width: '32px', height: '32px', borderRadius: '50%', 
                                            background: isOutOfRange ? '#ef4444' : '#2563eb', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 
                                        }}>
                                            {(worker.name || 'W')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{worker.name}</h4>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{assignedJob?.title || 'Worker'}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                                        <div className={isOutOfRange ? "pulse" : "pulse-green"} style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOutOfRange ? '#ef4444' : '#10b981' }} />
                                        <span style={{ fontSize: '0.75rem', color: isOutOfRange ? '#ef4444' : '#059669', fontWeight: 800 }}>
                                            {isOutOfRange ? t('out_of_zone') : t('status_online')} {isPermanent && '(Live)'}
                                        </span>
                                    </div>
                                    {dist !== null && (
                                        <div style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                            📍 {t('distance_from_site', { distance: Math.round(dist) })}
                                        </div>
                                    )}
                                    <p style={{ margin: '8px 0 0', fontSize: '0.65rem', color: '#64748b' }}>
                                        {isPermanent ? t('working_now') : `${t('last_seen')}: ${worker.currentLocation?.updatedAt ? new Date(worker.currentLocation.updatedAt).toLocaleTimeString() : 'N/A'}`}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                <MapBoundsController workers={activeWorkers} jobs={activeJobs} />
            </MapContainer>
        </div>
    );
};

export default GlobalTrackMap;
