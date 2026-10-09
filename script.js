const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const filesWithCurrency = new Set();
walkDir('./src/components', (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.match(/\$\s*\{?[a-zA-Z0-9_.()\[\]\n\r ]+\.toFixed\(/)) {
            filesWithCurrency.add(filePath);
        } else if (content.match(/\$\s*[0-9]+/)) {
            filesWithCurrency.add(filePath);
        } else if (content.match(/\$\s*\{/)) {
            filesWithCurrency.add(filePath);
        }
    }
});

console.log(Array.from(filesWithCurrency).join('\n'));
