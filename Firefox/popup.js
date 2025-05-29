let conversationsByTabTitle = {};

function createBasicElement(type, text, color) {
    const element = document.createElement(type);
    if (text) element.textContent = text;
    if (color) element.style.color = color;
    return element;
}

function createStyledDiv(className, tabTitle) {
    const div = document.createElement('div');
    if (className) div.className = className;
    if (tabTitle) div.setAttribute('data-tab-title', tabTitle);
    div.style.cursor = 'pointer';
    div.style.padding = '5px';
    div.style.margin = '5px 0';
    div.style.border = '1px solid #ccc';
    return div;
}

function createNoConversationsMessage(statusEl) {
    const container = createStyledDiv(null, null);
    container.style.color = 'blue';

    const header = createBasicElement('strong', 'No conversation captured yet');
    container.appendChild(header);
    container.appendChild(createBasicElement('br'));
    container.appendChild(createBasicElement('br'));

    const text = createBasicElement('div', 'To capture a conversation:');
    container.appendChild(text);

    const ul = document.createElement('ul');
    [
        'Navigate to a page with a URL containing "chat_conversations/"',
        'Ensure the page loads completely',
        'The extension will automatically try to capture the JSON'
    ].forEach(text => {
        const li = createBasicElement('li', text);
        ul.appendChild(li);
    });
    container.appendChild(ul);
    
    statusEl.appendChild(container);
}

// Updated to use conversationName instead of tabTitle for display
function createConversationItem(conversationName, conversation) {
    const container = createStyledDiv('conversation-item', conversationName);
    
    const titleLine = createBasicElement('strong', `Conversation: ${conversationName}`);
    container.appendChild(titleLine);
    container.appendChild(createBasicElement('br'));
    
    const urlLine = createBasicElement('span', `URL: ${conversation.url}`);
    container.appendChild(urlLine);
    container.appendChild(createBasicElement('br'));
    
    const timestampLine = createBasicElement('span', `Timestamp: ${conversation.timestamp}`);
    container.appendChild(timestampLine);
    
    return container;
}

// Updated to use conversationName instead of tabTitle for display and data attribute
function createDownloadOption(conversationName, conversation) {
    const container = createStyledDiv('download-option', conversationName);
    
    const titleLine = createBasicElement('strong', `Conversation: ${conversationName}`);
    container.appendChild(titleLine);
    container.appendChild(createBasicElement('br'));
    
    const urlLine = createBasicElement('span', `URL: ${conversation.url}`);
    container.appendChild(urlLine);
    container.appendChild(createBasicElement('br'));
    
    const timestampLine = createBasicElement('span', `Timestamp: ${conversation.timestamp}`);
    container.appendChild(timestampLine);
    container.appendChild(createBasicElement('br'));
    
    const button = createBasicElement('button', 'Download This Conversation');
    button.className = 'select-download';
    button.setAttribute('data-tab-title', conversationName); // Use conversationName here
    container.appendChild(button);
    
    return container;
}

function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

document.getElementById('viewBtn').addEventListener('click', async () => {
    try {
        const storage = await browser.storage.local.get('conversationsByTabTitle');
        conversationsByTabTitle = storage.conversationsByTabTitle || {};
        
        const statusEl = document.getElementById('status');
        clearElement(statusEl);
        
        // Removed filtering by 'Claude' tab title
        const availableConversations = conversationsByTabTitle;
        
        if (Object.keys(availableConversations).length > 0) {
            const header = createBasicElement('strong', 'Captured Conversations:');
            statusEl.appendChild(header);
            statusEl.appendChild(createBasicElement('br'));
            
            Object.entries(availableConversations).forEach(([conversationName, conversation]) => {
                statusEl.appendChild(createConversationItem(conversationName, conversation));
            });
        } else {
            createNoConversationsMessage(statusEl);
        }
    } catch (error) {
        console.error('Error viewing conversation:', error);
        const statusEl = document.getElementById('status');
        statusEl.textContent = `Error: ${error.message}`;
    }
});

document.getElementById('downloadBtn').addEventListener('click', async () => {
    try {
        const storage = await browser.storage.local.get('conversationsByTabTitle');
        conversationsByTabTitle = storage.conversationsByTabTitle || {};
        
        const statusEl = document.getElementById('status');
        clearElement(statusEl);
        
        // Removed filtering by 'Claude' tab title
        const availableConversations = conversationsByTabTitle;

        if (Object.keys(availableConversations).length === 0) {
            createNoConversationsMessage(statusEl);
            return;
        }

        // Removed specific 'Claude' tab check for download prevention,
        // as conversations are now stored by their actual names.
        // If a conversation's name happens to be 'Claude', it can now be downloaded.

        if (Object.keys(availableConversations).length > 1) {
            const header = createBasicElement('strong', 'Select a Conversation to Download:');
            statusEl.appendChild(header);
            statusEl.appendChild(createBasicElement('br'));
            
            Object.entries(availableConversations).forEach(([conversationName, conversation]) => {
                statusEl.appendChild(createDownloadOption(conversationName, conversation));
            });
            
            document.querySelectorAll('.select-download').forEach(button => {
                button.addEventListener('click', function() {
                    const conversationName = this.getAttribute('data-tab-title');
                    downloadConversation(conversationName);
                });
            });
            return;
        }

        if (Object.keys(availableConversations).length === 1) {
            const firstConversationName = Object.keys(availableConversations)[0];
            downloadConversation(firstConversationName);
        }
    } catch (error) {
        console.error('Error preparing download:', error);
        const statusEl = document.getElementById('status');
        statusEl.textContent = `Error: ${error.message}`;
    }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
    try {
        await browser.storage.local.remove('conversationsByTabTitle');
        conversationsByTabTitle = {};
        
        const statusEl = document.getElementById('status');
        clearElement(statusEl);
        
        const container = createStyledDiv(null, null);
        container.style.color = 'green';
        container.appendChild(createBasicElement('strong', 'Conversations Cleared'));
        container.appendChild(createBasicElement('br'));
        container.appendChild(createBasicElement('span', 'All captured conversations have been removed.'));
        statusEl.appendChild(container);
    } catch (error) {
        console.error('Error clearing conversations:', error);
        const statusEl = document.getElementById('status');
        statusEl.textContent = `Error: ${error.message}`;
    }
});

// Updated to use conversationName instead of tabTitle for download
function downloadConversation(conversationName) {
    // The 'Claude' tab title check is removed here as conversations are now stored by their actual names.
    // If a conversation's name happens to be 'Claude', it can still be downloaded.
    
    const conversation = conversationsByTabTitle[conversationName];
    
    if (conversation) {
        const jsonString = JSON.stringify(conversation.data);    
        const printArtifacts = document.getElementById('printArtifacts').checked;
        // Assuming generateHtml is available in the global scope via importScripts
        const html = generateHtml(jsonString, printArtifacts);

        const blob = new Blob([html], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_conversations_${conversation.timestamp.replace(/:/g, '-')}_${encodeURIComponent(conversationName)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        const statusEl = document.getElementById('status');
        clearElement(statusEl);
    }
}
// When the popup loads, restore the checkbox state
document.addEventListener('DOMContentLoaded', async () => {
  const checkbox = document.getElementById('printArtifacts');
  const storage = await browser.storage.local.get('printArtifactsEnabled');
  checkbox.checked = storage.printArtifactsEnabled || false;
});

// When the checkbox changes, save its state
document.getElementById('printArtifacts').addEventListener('change', async (e) => {
  await browser.storage.local.set({ printArtifactsEnabled: e.target.checked });
});
