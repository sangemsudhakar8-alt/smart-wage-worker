import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QRScanner = ({ onScanSuccess, onScanError }) => {
    const scannerRef = useRef(null);
    const onScanSuccessRef = useRef(onScanSuccess);
    const onScanErrorRef = useRef(onScanError);

    useEffect(() => {
        onScanSuccessRef.current = onScanSuccess;
        onScanErrorRef.current = onScanError;
    }, [onScanSuccess, onScanError]);

    useEffect(() => {
        // Initialize scanner
        const scanner = new Html5QrcodeScanner(
            "qr-reader", 
            { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                showTorchButtonIfSupported: true,
                rememberLastUsedCamera: true
            },
            /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                try {
                    const data = JSON.parse(decodedText);
                    if (data.type === 'attendance_check') {
                        // Success! Stop scanner and send back data
                        scanner.clear();
                        if (onScanSuccessRef.current) onScanSuccessRef.current(data);
                    } else {
                        if (onScanErrorRef.current) onScanErrorRef.current("Invalid QR Code Type.");
                    }
                } catch {
                    if (onScanErrorRef.current) onScanErrorRef.current("Could not parse QR code.");
                }
            },
            (errorMessage) => {
                // Ignore these, they happen continuously during scan
                console.log(errorMessage);
            }
        );

        scannerRef.current = scanner;

        // Cleanup on unmount
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear scanner", error);
                });
            }
        };
    }, []);

    return (
        <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <div id="qr-reader" style={{ width: '100%', border: 'none' }}></div>
            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                Point the camera at the worker's QR code to mark attendance.
            </p>
        </div>
    );
};

export default QRScanner;
