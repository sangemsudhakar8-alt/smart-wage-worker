import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom blue marker for worker
const workerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom red marker for jobs
const jobIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Helper component to adjust map bounds to fit all markers
const FitAllMarkers = ({ center, jobs }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && jobs.length > 0) {
      const bounds = L.latLngBounds([center]);
      jobs.forEach(job => {
        if (job.lat && job.lng) {
          bounds.extend([job.lat, job.lng]);
        }
      });
      // Add padding so markers aren't right on the edge
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [center, jobs, map]);
  
  return null;
};

const JobMap = ({ userCoords, jobs, onJobClick }) => {
  // Default to center if user location isn't provided yet
  const center = userCoords ? [userCoords.lat, userCoords.lng] : [20.5937, 78.9629];
  const zoom = userCoords ? 13 : 5;

  return (
    <div style={{ height: '450px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {/* We need the div wrapping the map to have a strict z-index so it doesn't overlap the bottom nav bar */}
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', zIndex: 0 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {userCoords && (
            <Marker position={[userCoords.lat, userCoords.lng]} icon={workerIcon}>
                <Popup>
                    <strong>📍 You are here</strong>
                </Popup>
            </Marker>
        )}

        {jobs.filter(j => j.lat && j.lng).map(job => (
          <Marker 
            key={job.id} 
            position={[job.lat, job.lng]} 
            icon={jobIcon}
            eventHandlers={{
                click: () => onJobClick && onJobClick(job)
            }}
          >
            <Popup>
              <div>
                <h4 style={{ margin: '0 0 5px' }}>{job.title}</h4>
                <p style={{ margin: '0 0 8px', color: '#666', fontSize: '0.85rem' }}>₹{job.wage} • {job.location}</p>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-sm btn-outline"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#eef2ff', borderColor: '#c7d2fe', width: '100%', textAlign: 'center' }}
                    >
                        Directions
                    </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {userCoords && <FitAllMarkers center={center} jobs={jobs} />}
      </MapContainer>
    </div>
  );
};

export default JobMap;
