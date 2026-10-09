import fs from 'fs';

const bundlePath = 'dist/assets/index-CGSK1k08.js';
if (fs.existsSync(bundlePath)) {
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    
    const ids = ['inventory_section', 'scanner_method', 'variety_package', 'worker_search', 'input_selector_tab'];
    
    for (const id of ids) {
        console.log(`\n==============================================`);
        console.log(`Searching for ID: ${id}`);
        console.log(`==============================================`);
        let pos = 0;
        let matchCount = 0;
        while ((pos = bundleContent.indexOf(id, pos)) !== -1) {
            matchCount++;
            if (pos < 2695000) {
                pos += id.length;
                continue;
            }
            console.log(`Match #${matchCount} of ${id} found at index ${pos}`);
            // Print a larger portion to capture the entire block rendering
            const start = Math.max(0, pos - 150);
            const end = Math.min(bundleContent.length, pos + 4000);
            console.log(`--- CONTEXT ---`);
            console.log(bundleContent.slice(start, end));
            console.log(`----------------`);
            pos += id.length;
            break;
        }
    }
} else {
    console.error('Bundle not found!');
}
