const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    const saveMockData = useCallback((key: string, items: any[]) => {
        if (!USE_FIREBASE || currentUser?.id === 'root-system') {
            const storageKey = \`mock_\${key}\`;
            const all = safeStorage.safeParse(localStorage.getItem(storageKey), []);
            const newAll = [...all];
            items.forEach(item => {
                const idx = newAll.findIndex(i => i.id === item.id);
                if (idx >= 0) newAll[idx] = item;
                else newAll.push(item);
            });
            localStorage.setItem(storageKey, JSON.stringify(newAll));
        }
    }, [currentUser, USE_FIREBASE]);`;

const replacement = `    const saveMockData = useCallback((key: string, items: any[]) => {
        const isFirebaseActive = USE_FIREBASE && currentUser?.id !== 'root-system';
        const storageKey = isFirebaseActive ? \`fb_cache_\${key}\` : \`mock_\${key}\`;
        
        let all = [];
        if (isFirebaseActive) {
            all = safeStorage.safeParse(safeStorage.getItem(storageKey), []);
        } else {
            all = safeStorage.safeParse(localStorage.getItem(storageKey), []);
        }

        const newAll = [...all];
        items.forEach(item => {
            const idx = newAll.findIndex(i => i.id === item.id);
            if (idx >= 0) newAll[idx] = item;
            else newAll.push(item);
        });

        if (isFirebaseActive) {
            safeStorage.setItemAsync(storageKey, JSON.stringify(newAll));
        } else {
            safeStorage.setItem(storageKey, JSON.stringify(newAll));
            try { localStorage.setItem(storageKey, JSON.stringify(newAll)); } catch (e) {}
        }
    }, [currentUser, USE_FIREBASE]);`;

file = file.replace(target, replacement);
fs.writeFileSync('src/App.tsx', file);
