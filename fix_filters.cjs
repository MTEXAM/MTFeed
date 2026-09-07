const fs = require('fs');

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  
  // Replace the weak filter with a strong filter
  const weakFilter = /const hasContent = p\.content && p\.content\.trim\(\)\.length > 0;\s*const hasMedia = !!p\.image \|\| !!p\.pdfUrl \|\| !!p\.poll;\s*return hasContent \|\| hasMedia;/g;
  const strongFilter = `const hasContent = typeof p.content === 'string' && p.content.trim().length > 0 && p.content !== 'undefined' && p.content !== 'null';
            const hasImage = typeof p.image === 'string' && p.image.trim().length > 0 && p.image !== 'undefined';
            const hasPdf = typeof p.pdfUrl === 'string' && p.pdfUrl.trim().length > 0 && p.pdfUrl !== 'undefined';
            const hasPoll = p.poll && Array.isArray(p.poll.options) && p.poll.options.length > 0;
            return hasContent || hasImage || hasPdf || hasPoll;`;
            
  code = code.replace(weakFilter, strongFilter);
  fs.writeFileSync(filePath, code);
  console.log('Updated ' + filePath);
}

function updateSheets(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  
  const weakFilter = /const hasContent = post\.content && post\.content\.trim\(\)\.length > 0;\s*const hasMedia = !!post\.image \|\| !!post\.pdfUrl \|\| !!post\.poll;\s*return hasContent \|\| hasMedia;/g;
  const strongFilter = `const hasContent = typeof post.content === 'string' && post.content.trim().length > 0 && post.content !== 'undefined' && post.content !== 'null';
    const hasImage = typeof post.image === 'string' && post.image.trim().length > 0 && post.image !== 'undefined';
    const hasPdf = typeof post.pdfUrl === 'string' && post.pdfUrl.trim().length > 0 && post.pdfUrl !== 'undefined';
    const hasPoll = post.poll && Array.isArray(post.poll.options) && post.poll.options.length > 0;
    return hasContent || hasImage || hasPdf || hasPoll;`;
    
  code = code.replace(weakFilter, strongFilter);
  fs.writeFileSync(filePath, code);
  console.log('Updated ' + filePath);
}

updateFile('src/utils/firestoreService.ts');
updateFile('src/App.tsx');
updateSheets('src/utils/googleSheetsService.ts');
