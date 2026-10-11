import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Employee } from '../types';

interface EmployeeIdCardProps {
    employee: Employee;
    roleName: string;
    qrCodeDataUrl?: string;
}

const EmployeeIdCard: React.FC<EmployeeIdCardProps> = ({ employee, roleName, qrCodeDataUrl }) => {
    const [qrUrl, setQrUrl] = useState<string>('');
    
    useEffect(() => {
        const displayBarcode = employee.barcode || employee.idNumber || employee.id;
        if (qrCodeDataUrl) {
            setQrUrl(qrCodeDataUrl);
        } else if (displayBarcode) {
            const qrCodeData = JSON.stringify({
                id: displayBarcode,
                name: employee.name,
                role: roleName,
            });
            QRCode.toDataURL(qrCodeData, { width: 300, margin: 1 })
                .then(url => setQrUrl(url))
                .catch(err => console.error("QRCode generation failed:", err));
        }
    }, [employee, roleName, qrCodeDataUrl]);

    return (
        <div style={{
            width: '3.375in', 
            height: '2.125in', 
            padding: '12px', 
            border: '1px solid #e5e7eb', 
            borderRadius: '12px', 
            fontFamily: "'Inter', sans-serif", 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            backgroundColor: 'white',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    backgroundColor: '#f3f4f6', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <svg style={{ width: '36px', height: '36px', color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1f2937', margin: 0, lineHeight: 1.2 }}>
                        {employee.name}
                    </h2>
                    <p style={{ fontSize: '0.8rem', fontWeight: '500', color: '#16a34a', margin: 0, marginTop: '2px' }}>
                        {roleName}
                    </p>
                </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '0.65rem', color: '#4b5563', lineHeight: 1.4 }}>
                    <p style={{ margin: 0 }}><strong>ID:</strong> {employee.idNumber}</p>
                    <p style={{ margin: 0 }}><strong>Type:</strong> {employee.employeeType}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                    <div style={{ width: '80px', height: '80px' }}>
                        {qrUrl ? (
                            <img src={qrUrl} alt="QR Code" style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', fontSize: '10px', color: '#9ca3af' }}>...</div>
                        )}
                    </div>
                    <p style={{ fontSize: '0.65rem', marginTop: '2px', marginBottom: 0, fontWeight: 'bold', color: '#1f2937' }}>
                        #{employee.barcode || employee.idNumber || employee.id}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EmployeeIdCard;