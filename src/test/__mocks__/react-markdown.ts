import React from 'react';

const ReactMarkdown: React.FC<{ children: string, components?: Record<string, any> }> = ({ children, components }) => {
  if (!components) return React.createElement('div', null, children);

  const lines = children.split('\n');
  const elements = [];
  let listItems = [];
  let tableRows = [];
  let blockquoteContent = [];
  let nestedLevel = 0;
  
  const processInlineStyles = (text: string): (string | React.ReactElement)[] => {
    const parts: (string | React.ReactElement)[] = [];
    let currentText = text;
    
    // Process bold text
    while (currentText.includes('**')) {
      const start = currentText.indexOf('**');
      const end = currentText.indexOf('**', start + 2);
      if (end === -1) break;
      
      // Add text before the bold
      if (start > 0) {
        parts.push(currentText.slice(0, start));
      }
      
      // Add the bold element
      const boldText = currentText.slice(start + 2, end);
      parts.push(React.createElement('strong', { 
        key: `bold-${start}`,
        className: 'font-bold' 
      }, boldText));
      
      currentText = currentText.slice(end + 2);
    }
    if (currentText) parts.push(currentText);
    
    // Process italics
    const processedParts: (string | React.ReactElement)[] = [];
    for (const part of parts) {
      if (typeof part !== 'string') {
        processedParts.push(part);
        continue;
      }
      
      let currentPart = part;
      const italicParts: (string | React.ReactElement)[] = [];
      
      while (currentPart.includes('*')) {
        const start = currentPart.indexOf('*');
        const end = currentPart.indexOf('*', start + 1);
        if (end === -1) break;
        
        if (start > 0) {
          italicParts.push(currentPart.slice(0, start));
        }
        
        const italicText = currentPart.slice(start + 1, end);
        italicParts.push(React.createElement('em', { 
          key: `italic-${start}`,
          className: 'italic' 
        }, italicText));
        
        currentPart = currentPart.slice(end + 1);
      }
      if (currentPart) italicParts.push(currentPart);
      
      processedParts.push(...italicParts);
    }
    
    // Process inline code
    const finalParts: (string | React.ReactElement)[] = [];
    for (const part of processedParts) {
      if (typeof part !== 'string') {
        finalParts.push(part);
        continue;
      }
      
      let currentPart = part;
      const codeParts: (string | React.ReactElement)[] = [];
      
      while (currentPart.includes('`')) {
        const start = currentPart.indexOf('`');
        const end = currentPart.indexOf('`', start + 1);
        if (end === -1) break;
        
        if (start > 0) {
          codeParts.push(currentPart.slice(0, start));
        }
        
        const codeText = currentPart.slice(start + 1, end);
        codeParts.push(React.createElement('code', { 
          key: `code-${start}`,
          className: 'inline-code' 
        }, codeText));
        
        currentPart = currentPart.slice(end + 1);
      }
      if (currentPart) codeParts.push(currentPart);
      
      finalParts.push(...codeParts);
    }
    
    return finalParts;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle blockquotes
    if (line.startsWith('> ')) {
      blockquoteContent.push(...processInlineStyles(line.slice(2)));
      continue;
    } else if (blockquoteContent.length > 0) {
      elements.push(React.createElement('blockquote', { 
        key: `blockquote-${i}`,
        className: 'pl-4 border-l-4 border-gray-300 italic'
      }, blockquoteContent));
      blockquoteContent = [];
    }
    
    // Handle headings
    if (line.startsWith('# ')) {
      if (listItems.length > 0) {
        elements.push(React.createElement('ul', { 
          key: `list-${i}`, 
          role: 'list',
          className: `ml-${nestedLevel * 4}`
        }, listItems));
        listItems = [];
      }
      elements.push(React.createElement('h1', { 
        key: i, 
        role: 'heading', 
        'aria-level': 1 
      }, processInlineStyles(line.slice(2))));
      continue;
    }
    
    if (line.startsWith('## ')) {
      if (listItems.length > 0) {
        elements.push(React.createElement('ul', { 
          key: `list-${i}`, 
          role: 'list',
          className: `ml-${nestedLevel * 4}`
        }, listItems));
        listItems = [];
      }
      elements.push(React.createElement('h2', { 
        key: i, 
        role: 'heading', 
        'aria-level': 2 
      }, processInlineStyles(line.slice(3))));
      continue;
    }
    
    // Handle nested lists
    if (line.match(/^(\s*)-\s/)) {
      const spaceMatch = line.match(/^(\s*)/);
      const spaces = spaceMatch ? spaceMatch[0].length : 0;
      const newLevel = Math.floor(spaces / 2);
      
      if (newLevel !== nestedLevel) {
        if (listItems.length > 0) {
          elements.push(React.createElement('ul', { 
            key: `list-${i}`, 
            role: 'list',
            className: `ml-${nestedLevel * 4}`
          }, listItems));
          listItems = [];
        }
        nestedLevel = newLevel;
      }
      
      listItems.push(React.createElement('li', { 
        key: `li-${i}`,
        className: `ml-${nestedLevel * 4}`
      }, processInlineStyles(line.trim().slice(2))));
      continue;
    }
    
    // Handle tables
    if (line.includes('|')) {
      const cells = line.split('|').filter(Boolean).map(cell => cell.trim());
      
      if (line.includes('---')) {
        // This is a table header separator, skip it
        continue;
      }
      
      if (tableRows.length === 0) {
        // This is a header row
        tableRows.push(React.createElement('tr', { key: `tr-header-${i}` },
          cells.map((cell, cellIndex) => 
            React.createElement('th', { 
              key: `th-${i}-${cellIndex}`,
              className: 'border px-4 py-2 bg-gray-100'
            }, processInlineStyles(cell)))
        ));
      } else {
        // This is a data row
        tableRows.push(React.createElement('tr', { key: `tr-${i}` },
          cells.map((cell, cellIndex) => 
            React.createElement('td', { 
              key: `td-${i}-${cellIndex}`,
              className: 'border px-4 py-2'
            }, processInlineStyles(cell)))
        ));
      }
      continue;
    } else if (tableRows.length > 0) {
      // End of table
      const [headerRow, ...bodyRows] = tableRows;
      elements.push(React.createElement('table', { 
        key: `table-${i}`,
        className: 'min-w-full border-collapse border'
      }, [
        React.createElement('thead', { key: 'thead' }, headerRow),
        React.createElement('tbody', { key: 'tbody' }, bodyRows)
      ]));
      tableRows = [];
    }
    
    // Handle code blocks
    if (line.startsWith('```')) {
      let codeContent = [];
      const language = line.slice(3).trim();
      i++; // Skip the opening ```
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeContent.push(lines[i]);
        i++;
      }
      elements.push(React.createElement('pre', { 
        key: `pre-${i}`,
        className: 'bg-gray-100 p-4 rounded'
      }, React.createElement('code', { 
        key: `code-${i}`, 
        role: 'code',
        className: `language-${language}`
      }, codeContent.join('\n'))));
      continue;
    }
    
    // Handle links
    if (line.includes('[') && line.includes(']')) {
      const linkText = line.match(/\[(.*?)\]/)?.[1] || '';
      const linkHref = line.match(/\((.*?)\)/)?.[1] || '';
      elements.push(React.createElement('a', { 
        key: i, 
        href: linkHref,
        className: 'text-blue-500 hover:underline'
      }, processInlineStyles(linkText)));
      continue;
    }
    
    // Handle regular text with inline styles
    if (line.trim()) {
      elements.push(React.createElement('div', { key: i }, processInlineStyles(line)));
    }
  }
  
  // Handle any remaining elements
  if (listItems.length > 0) {
    elements.push(React.createElement('ul', { 
      key: 'final-list', 
      role: 'list',
      className: `ml-${nestedLevel * 4}`
    }, listItems));
  }
  
  if (blockquoteContent.length > 0) {
    elements.push(React.createElement('blockquote', { 
      key: 'final-blockquote',
      className: 'pl-4 border-l-4 border-gray-300 italic'
    }, blockquoteContent));
  }
  
  if (tableRows.length > 0) {
    const [headerRow, ...bodyRows] = tableRows;
    elements.push(React.createElement('table', { 
      key: 'final-table',
      className: 'min-w-full border-collapse border'
    }, [
      React.createElement('thead', { key: 'thead' }, headerRow),
      React.createElement('tbody', { key: 'tbody' }, bodyRows)
    ]));
  }

  return React.createElement('div', null, elements);
};

export default ReactMarkdown; 