import { useState, useRef, useEffect, useCallback } from 'react';
import { safeStorage } from '../services/storageService';

export interface Position {
    x: number;
    y: number;
}

export function useMovableFloatingWidget(
    storageKey: string,
    defaultPos: Position | null = null
) {
    const [pos, setPos] = useState<Position | null>(() => {
        const stored = safeStorage.getItem(storageKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
                    return parsed;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
        return defaultPos;
    });

    const [isDragging, setIsDragging] = useState(false);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const dragDataRef = useRef<{
        startX: number;
        startY: number;
        startLeft: number;
        startTop: number;
        pointerId: number;
    } | null>(null);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
        // Prevent drag on interactive children
        if ((e.target as HTMLElement).closest('button, input, select, a, textarea, [data-no-drag]')) {
            return;
        }

        e.stopPropagation();
        const target = e.currentTarget;
        try {
            target.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = elementRef.current?.getBoundingClientRect();
        const currentLeft = rect ? rect.left : (pos?.x ?? 20);
        const currentTop = rect ? rect.top : (pos?.y ?? 20);

        dragDataRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: currentLeft,
            startTop: currentTop,
            pointerId: e.pointerId
        };
        setIsDragging(true);
    }, [pos]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
        if (!dragDataRef.current) return;
        e.stopPropagation();

        const deltaX = e.clientX - dragDataRef.current.startX;
        const deltaY = e.clientY - dragDataRef.current.startY;

        const elWidth = elementRef.current?.offsetWidth || 200;
        const elHeight = elementRef.current?.offsetHeight || 60;

        // Keep inside viewport with 12px padding
        const newLeft = Math.max(12, Math.min(window.innerWidth - elWidth - 12, dragDataRef.current.startLeft + deltaX));
        const newTop = Math.max(12, Math.min(window.innerHeight - elHeight - 12, dragDataRef.current.startTop + deltaY));

        setPos({ x: Math.round(newLeft), y: Math.round(newTop) });
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
        if (!dragDataRef.current) return;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}

        dragDataRef.current = null;
        setIsDragging(false);

        setPos(current => {
            if (current) {
                safeStorage.setItem(storageKey, JSON.stringify(current));
            }
            return current;
        });
    }, [storageKey]);

    const resetPos = useCallback(() => {
        setPos(defaultPos);
        if (defaultPos) {
            safeStorage.setItem(storageKey, JSON.stringify(defaultPos));
        } else {
            safeStorage.removeItem(storageKey);
        }
    }, [storageKey, defaultPos]);

    return {
        pos,
        setPos,
        resetPos,
        isDragging,
        elementRef,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp
    };
}
