const fs = require('fs');
const path = require('path');

// Fix paths in index.html for GitHub Pages
const indexPath = path.join(__dirname, 'web-build', 'index.html');

if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Fix script and favicon paths to be relative
  content = content.replace(
    /src="\/_expo\/static\/js\/web\/[^"]+\.js"/g,
    (match) => match.replace('src="/', 'src="./')
  );
  
  content = content.replace(
    /href="\/favicon\.ico"/g,
    'href="./favicon.ico"'
  );
  
  fs.writeFileSync(indexPath, content);
  console.log('✅ Fixed paths in index.html for GitHub Pages');
} else {
  console.log('❌ index.html not found');
}
