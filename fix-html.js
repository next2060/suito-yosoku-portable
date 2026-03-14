const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'build', 'index.html');
if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    // Remove type="module" and crossorigin from all script tags, and add 'defer'
    html = html.replace(/<script([^>]*)type="module"([^>]*)crossorigin([^>]*)>/gi, '<script defer$1$2$3>');
    html = html.replace(/<script([^>]*)type="module"([^>]*)>/gi, '<script defer$1$2>');
    
    // Find CSS link tags and fully inline their content to avoid file:/// CORS CSS rules errors
    const linkRegex = /<link([^>]*)rel="stylesheet"([^>]*)href="([^"]+)"([^>]*)>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        const fullMatch = match[0];
        // Ensure relative paths for file resolution
        let cssPath = match[3];
        if (cssPath.startsWith('/')) {
            cssPath = cssPath.substring(1); // remove leading slash
        } else if (cssPath.startsWith('./')) {
            cssPath = cssPath.substring(2);
        }
        
        const absoluteCssPath = path.join(__dirname, 'build', cssPath);
        if (fs.existsSync(absoluteCssPath)) {
            const cssContent = fs.readFileSync(absoluteCssPath, 'utf8');
            const styleElement = `<style>\n${cssContent}\n</style>`;
            html = html.replace(fullMatch, styleElement);
            console.log(`Inlined CSS: ${cssPath}`);
            // Optionally delete the css file to keep dist clean
            try { fs.unlinkSync(absoluteCssPath); } catch(e) {}
        }
    }
    
    // Remove crossorigin from any remaining link tags
    html = html.replace(/<link([^>]*)crossorigin([^>]*)>/gi, '<link$1$2>');
    
    fs.writeFileSync(indexPath, html);
    console.log('Successfully stripped module types from index.html for file:// protocol support.');
} else {
    console.error('dist/index.html not found!');
    process.exit(1);
}
