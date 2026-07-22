import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

const WorkerQR = ({ workerId, workerName }) => {
    // Generate a secure payload for today's attendance
    const today = new Date().toISOString().split('T')[0];
    const payload = JSON.stringify({
        workerId: workerId,
        date: today,
        name: workerName,
        type: 'attendance_check'
    });

    return (
        <div style={{ padding: '2rem', background: 'white', borderRadius: '24px', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-dark)' }}>My Attendance QR</h3>
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', display: 'inline-block', border: '2px solid var(--primary-color)' }}>
                <QRCodeSVG 
                    value={payload} 
                    size={220}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                        src: "/vite.svg", // Optional center logo
                        x: undefined,
                        y: undefined,
                        height: 40,
                        width: 40,
                        excavate: true,
                    }}
                />
            </div>
            <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-light)', fontWeight: 600 }}>
                Show this to your employer to mark today's attendance.
            </p>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.6 }}>
                Valid for: {new Date().toLocaleDateString()}
            </div>
        </div>
    );
};

export default WorkerQR;
