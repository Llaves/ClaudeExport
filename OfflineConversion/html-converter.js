// HTML Converter for Claude Chat Archives

const typeLookup = {
  "application/vnd.ant.react": "jsx",
  "text/html": "html"
};

function parser(input) {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (match) {
    const entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entityMap[match];
  });
}

function replaceInlineCode(text) {
  // Handle triple backticks code blocks
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre class="code-block ${lang}">${escapeHtml(code)}</pre>`;
  });

  // Handle inline code with single backticks
  text = text.replace(/`([^`]+)`/g, (match, code) => {
    return `<code class="inline-code">${escapeHtml(code)}</code>`;
  });

  // Process nested numbered lists
  function processNestedNumberedList(text) {
    const lines = text.split('\n');
    const rootList = { items: [], type: 'ol', class: 'numbered-list' };
    const stack = [rootList];
    let currentIndentLevel = 0;

    // Helper function to get indent level
    function getIndentLevel(line) {
      const match = line.match(/^(\s*)\d+\./);
      return match ? Math.floor(match[1].length / 3) : 0;
    }

    // Helper function to create HTML
    function createListHtml(list) {
      const items = list.items.map(item => {
        if (typeof item === 'string') {
          return item;
        }
        return `<${item.type} class="${item.class}">${createListHtml(item)}</${item.type}>`;
      }).join('\n');
      return items;
    }

    lines.forEach(line => {
      // Skip empty lines
      if (!line.trim()) return;

      // Check if line is a numbered item
      const numberMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (!numberMatch) return;

      const [, indent, number, content] = numberMatch;
      const indentLevel = getIndentLevel(line);

      // Create list item HTML with value attribute
      const listItem = `<li value="${number}">${content.trim()}</li>`;

      // Handle indentation changes
      if (indentLevel > currentIndentLevel) {
        // Create new nested list
        const newList = { items: [listItem], type: 'ol', class: 'numbered-list' };
        // Add the new list to the last item of the parent list
        const parentList = stack[stack.length - 1];
        if (typeof parentList.items[parentList.items.length - 1] === 'string') {
          // Convert the last string item to contain the nested list
          const lastItem = parentList.items[parentList.items.length - 1];
          parentList.items[parentList.items.length - 1] = lastItem.replace('</li>', '');
          parentList.items.push(newList);
          parentList.items.push('</li>');
        }
        stack.push(newList);
      } else if (indentLevel < currentIndentLevel) {
        // Pop lists from stack until we reach the correct level
        while (currentIndentLevel > indentLevel && stack.length > 1) {
          stack.pop();
          currentIndentLevel--;
        }
        stack[stack.length - 1].items.push(listItem);
      } else {
        // Same level, just add the item
        stack[stack.length - 1].items.push(listItem);
      }

      currentIndentLevel = indentLevel;
    });

    return `<ol class="numbered-list">${createListHtml(rootList)}</ol>`;
  }

  // Find all numbered list sections and process them
  // Updated regex to better identify numbered lists
  text = text.replace(/(?:^|\n)(?:\s*\d+\.\s+.+(?:\n|$))+/gm, match => {
    return `\n${processNestedNumberedList(match.trim())}\n`;
  });

  // Process nested bullet lists
  function processNestedList(text) {
    const lines = text.split('\n');
    const rootList = { items: [], type: 'ul', class: 'bulleted-list' };
    const stack = [rootList];
    let currentIndentLevel = 0;

    // Helper function to get indent level
    function getIndentLevel(line) {
      const match = line.match(/^(\s*)([-*])/);
      return match ? Math.floor(match[1].length / 2) : 0;
    }

    // Helper function to create HTML
    function createListHtml(list) {
      const items = list.items.map(item => {
        if (typeof item === 'string') {
          return item;
        }
        return `<${item.type} class="${item.class}">${createListHtml(item)}</${item.type}>`;
      }).join('\n');
      return items;
    }

    lines.forEach(line => {
      // Skip empty lines
      if (!line.trim()) return;

      // Check if line is a bullet point
      const bulletMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
      if (!bulletMatch) return;

      const [, indent, bullet, content] = bulletMatch;
      const indentLevel = getIndentLevel(line);

      // Create list item HTML
      const listItem = `<li>${content.trim()}</li>`;

      // Handle indentation changes
      if (indentLevel > currentIndentLevel) {
        // Create new nested list
        const newList = { items: [listItem], type: 'ul', class: 'bulleted-list' };
        // Add the new list to the last item of the parent list
        const parentList = stack[stack.length - 1];
        if (typeof parentList.items[parentList.items.length - 1] === 'string') {
          // Convert the last string item to contain the nested list
          const lastItem = parentList.items[parentList.items.length - 1];
          parentList.items[parentList.items.length - 1] = lastItem.replace('</li>', '');
          parentList.items.push(newList);
          parentList.items.push('</li>');
        }
        stack.push(newList);
      } else if (indentLevel < currentIndentLevel) {
        // Pop lists from stack until we reach the correct level
        while (currentIndentLevel > indentLevel && stack.length > 1) {
          stack.pop();
          currentIndentLevel--;
        }
        stack[stack.length - 1].items.push(listItem);
      } else {
        // Same level, just add the item
        stack[stack.length - 1].items.push(listItem);
      }

      currentIndentLevel = indentLevel;
    });

    return `<ul class="bulleted-list">${createListHtml(rootList)}</ul>`;
  }

  // Find all bullet list sections and process them
  text = text.replace(/(?:^|\n)(?:[-*]\s+.+\n?)+/gs, match => {
    return `\n${processNestedList(match.trim())}\n`;
  });

  return text;
}

let artifactCounter = 0;
// Modify the function that replaces artifact tags
function replaceArtifactTags(input, artifactPanels, printArtifacts = false) {
  const regex = /<antArtifact[^>]*>([\s\S]*?)(<\/antArtifact>|$)/g;
  let matches = [...input.matchAll(regex)];

  function extractAttributes(tag) {
    const attributes = {};
    const attrRegex = /(\w+)=("([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = attrRegex.exec(tag)) !== null) {
      const key = match[1];
      const value = match[3] || match[4];
      attributes[key] = value;
    }
    return attributes;
  }

  function createArtifactPanel(artifactId, title, content, lang) {
    artifactPanels.push(`
      <div class="artifact-panel" id="${artifactId}">
        <div class="artifact-panel-header">
          <h3>${title}</h3>
          <button class="close-panel" aria-label="Close panel">&times;</button>
        </div>
        <div class="artifact-panel-content">
          <pre class="code-block ${lang}">${escapeHtml(content)}</pre>
        </div>
      </div>
    `);
  }

  let result = input;

  matches.forEach((match) => {
    const fullMatch = match[0];
    let content = match[1];
    const hasClosingTag = match[2] === "</antArtifact>";
    const openingTag = match[0].substring(0, match[0].indexOf('>') + 1);
    const attributes = extractAttributes(openingTag);
    const lang = attributes.language || typeLookup[attributes.type] || "";
    const artifactId = `artifact-${artifactCounter}`;
    const title = attributes.title || "Untitled";

    if (!hasClosingTag) {
      content += "\n\n\n THIS ARTIFACT IS INCOMPLETE BECAUSE THE MAX MESSAGE LENGTH WAS EXCEEDED.";
    }

    createArtifactPanel(artifactId, title, content, lang);

    result = result.replace(fullMatch, `
      <div class="artifact-wrapper">
        <p class="artifact-button-wrapper ${printArtifacts ? 'print-enabled' : ''}">
          <button class="artifact-button" data-artifact-id="${artifactId}">
            <svg class="artifact-icon" width="16" height="16" viewBox="0 0 16 16">
              <path fill="currentColor" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
            </svg>
            <span class="artifact-title">${title}</span>
          </button>
        </p>
        <div class="artifact-inline ${printArtifacts ? 'print-enabled' : ''}">
          <h4>${title}</h4>
          <pre class="code-block ${lang}">${escapeHtml(content)}</pre>
        </div>
      </div>
    `);
    artifactCounter++;
  });

  return result;
}


function generateHtml(input, printArtifacts = false) {
  const parsed = parser(input);
  if (!parsed.chat_messages) {
    return "";
  }

  const artifactPanels = [];

  // Sort chat_messages by created_at timestamp
  parsed.chat_messages.sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return dateA.getTime() - dateB.getTime();
  });

  const messages = parsed.chat_messages.map(message => {
    const messageContent = message.content.map(content => {
      if (content.type == "tool_use") {
        if (content.name == "repl") {
          const artifactId = `repl-${content.id}`;
          artifactPanels.push(`
            <div class="artifact-panel" id="${artifactId}">
              <div class="artifact-panel-header">
                <h3>Analysis</h3>
                <button class="close-panel" aria-label="Close panel">&times;</button>
              </div>
              <div class="artifact-panel-content">
                <pre class="code-block javascript">${escapeHtml(content.input.code.trim())}</pre>
              </div>
            </div>
          `);
          return `
            <div class="artifact-wrapper">
              <p class="artifact-button-wrapper ${printArtifacts ? 'print-enabled' : ''}">
                <button class="artifact-button" data-artifact-id="${artifactId}">
                  <svg class="artifact-icon" width="16" height="16" viewBox="0 0 16 16">
                    <path fill="currentColor" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
                  </svg>
                  <span class="artifact-title">Analysis</span>
                </button>
              </p>
              <div class="artifact-inline ${printArtifacts ? 'print-enabled' : ''}">
                <h4>Analysis</h4>
                <pre class="code-block javascript">${escapeHtml(content.input.code.trim())}</pre>
              </div>
            </div>
          `;
        }
      } else if (content.text) {
        let processedText = replaceArtifactTags(content.text, artifactPanels, printArtifacts);
        processedText = replaceInlineCode(processedText);
        return processedText;
      }
      return escapeHtml(JSON.stringify(content));
    }).join('\n');

    const timestamp = new Date(message.created_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    return `
      <div class="message ${message.sender.toLowerCase()}">
        <div class="message-header">
          <span class="sender">${escapeHtml(message.sender)}</span>
          <span class="timestamp">${timestamp}</span>
        </div>
        <div class="message-content">
          ${messageContent}
        </div>
      </div>
    `;
  }).join('\n');

  const styleSheet = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #f9fafb;
      }
      .container {
        display: flex;
        justify-content: center;
      }
      .chat-container {
        flex: 0 1 1000px;
        padding: 20px;
        transition: max-width 0.3s ease;
      }
      .container.has-panel .chat-container {
        flex: 0 1 1000px;
      }
      .artifact-container {
        width: 0;
        background: white;
        border-left: 1px solid #e5e7eb;
        transition: width 0.3s ease;
        overflow: hidden;
        flex-shrink: 0;
        position: sticky;
        top: 0;
        height: 100vh;
      }
      .artifact-container.active {
        width: 800px;
      }
      .conversation-title {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 20px;
        color: #111827;
      }
      .message {
        margin-bottom: 24px;
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      .message-header {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }
      .sender {
        font-weight: 600;
        color: #111827;
        margin-right: 12px;
      }
      .timestamp {
        color: #6b7280;
        font-size: 0.875rem;
      }
      .message-content {
        color: #1f2937;
      }

      .artifact-button-wrapper {
        margin: 1em 0;
      }
      .artifact-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background-color: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        color: #374151;
        transition: background-color 0.2s;
      }
      .artifact-button:hover {
        background-color: #e5e7eb;
      }
      .artifact-icon {
        width: 16px;
        height: 16px;
      }
      .artifact-panel {
        display: none;
        height: 100%;
        flex-direction: column;
      }
      .artifact-panel.active {
        display: flex;
      }
      .artifact-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }
      .artifact-panel-header h3 {
        margin: 0;
        font-size: 16px;
        color: #111827;
      }
      .close-panel {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        padding: 0 8px;
      }
      .close-panel:hover {
        color: #111827;
      }
      .artifact-panel-content {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
      }
      .code-block {
        margin: 0;
        padding: 12px;
        background: #f8fafc;
        overflow-x: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.875rem;
        white-space: pre-wrap;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      }
      .inline-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.875rem;
        background: #f3f4f6;
        padding: 2px 4px;
        border-radius: 4px;
      }
      .human {
        background: #f3f4f6;
      }
      .assistant {
        background: white;
        font-family: "Times New Roman", Times, serif;
        font-size: 110%;
      }
      
      /* New styles for inline artifacts */
      .artifact-inline {
        display: none;
        margin: 1em 0;
        padding: 1em;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
      }
      
      .artifact-inline h4 {
        margin: 0 0 1em 0;
        color: #111827;
      }
      
      .artifact-inline.print-enabled {
        display: none; /* Still hidden in normal view */
      }

      @media print {
        .artifact-button-wrapper {
          display: none; /* Hide all artifact buttons when printing */
        }
        .artifact-inline.print-enabled {
          display: block; /* Only show artifacts that are print-enabled */
        }
        .artifact-inline:not(.print-enabled) {
          display: none; /* Explicitly hide non-print-enabled artifacts */
        }
      }
          
  .numbered-list {
    margin: 16px 0;
    padding-left: 40px;
  }

  .numbered-list li {
    margin-bottom: 8px;
  }

  .bulleted-list {
    margin: 16px 0;
    padding-left: 40px;
    list-style-type: disc;
  }

  .bulleted-list .bulleted-list {
    margin: 8px 0 8px 0;
    list-style-type: circle;
  }

  .bulleted-list .bulleted-list .bulleted-list {
    list-style-type: square;
  }

  .bulleted-list li {
    margin-bottom: 8px;
  }  
      @media print {
        body {
          background-color: white;
        }
        .container {
          display: block;
        }
        .chat-container {
          max-width: 100%;
          padding: 0;
        }
        .artifact-container {
          display: none;
        }
        .artifact-button-wrapper.print-enabled {
          display: none;
        }
        .artifact-inline.print-enabled {
          display: block;
        }
      }
    </style>
  `;

  const script = `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const container = document.querySelector('.container');
      const artifactContainer = document.querySelector('.artifact-container');
      const artifactPanels = document.querySelectorAll('.artifact-panel');
      const artifactButtons = document.querySelectorAll('.artifact-button');
      const closePanelButtons = document.querySelectorAll('.close-panel');

      let currentPanelId = null;

      function hideAllPanels() {
        artifactPanels.forEach(panel => {
          panel.classList.remove('active');
      });
        artifactContainer.classList.remove('active');
        container.classList.remove('has-panel');
        currentPanelId = null;
      }

      function showPanel(panelId) {
        // First hide all panels
        artifactPanels.forEach(panel => {
          panel.classList.remove('active');
        });

        // Show the selected panel
        const panel = document.getElementById(panelId);
        if (panel) {
          panel.classList.add('active');
          artifactContainer.classList.add('active');
          container.classList.add('has-panel');
          currentPanelId = panelId;
        }
      }

      artifactButtons.forEach(button => {
        button.addEventListener('click', () => {
          const artifactId = button.dataset.artifactId;

          // If clicking the same button that's currently shown, hide it
          if (artifactId === currentPanelId) {
            hideAllPanels();
          } else {
            // If clicking a different button, show its content
            showPanel(artifactId);
          }
        });
      });

      closePanelButtons.forEach(button => {
        button.addEventListener('click', hideAllPanels);
      });

    });
  </script>
`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(parsed.name)}</title>
      ${styleSheet}
    </head>
    <body>
      <div class="container">
        <div class="chat-container">
          <div class="conversation-title">${escapeHtml(parsed.name)}</div>
          ${messages}
        </div>
        <div class="artifact-container">
          ${artifactPanels.join('\n')}
        </div>
      </div>
      ${script}
    </body>
    </html>
  `;
}