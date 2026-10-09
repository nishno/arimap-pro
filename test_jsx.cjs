const fs = require('fs');
const content = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');
try {
  require('@babel/core').transformSync(content, {
    presets: ['@babel/preset-react', '@babel/preset-typescript'],
    filename: 'test.tsx'
  });
  console.log("Valid JSX");
} catch(e) {
  console.error(e.message);
}
