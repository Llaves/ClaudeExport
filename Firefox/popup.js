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

function createConversationItem(tabTitle, conversation) {
    const container = createStyledDiv('conversation-item', tabTitle);
    
    const titleLine = createBasicElement('strong', `Tab: ${tabTitle}`);
    container.appendChild(titleLine);
    container.appendChild(createBasicElement('br'));
    
    const urlLine = createBasicElement('span', `URL: ${conversation.url}`);
    container.appendChild(urlLine);
    container.appendChild(createBasicElement('br'));
    
    const timestampLine = createBasicElement('span', `Timestamp: ${conversation.timestamp}`);
    container.appendChild(timestampLine);
    
    return container;
}

function createDownloadOption(tabTitle, conversation) {
    const container = createStyledDiv('download-option', tabTitle);
    
    const titleLine = createBasicElement('strong', `Tab: ${tabTitle}`);
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
    button.setAttribute('data-tab-title', tabTitle);
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
        
        const filteredConversations = Object.fromEntries(
            Object.entries(conversationsByTabTitle)
                .filter(([tabTitle]) => tabTitle !== 'Claude')
        );
        
        if (Object.keys(filteredConversations).length > 0) {
            const header = createBasicElement('strong', 'Captured Conversations:');
            statusEl.appendChild(header);
            statusEl.appendChild(createBasicElement('br'));
            
            Object.entries(filteredConversations).forEach(([tabTitle, conversation]) => {
                statusEl.appendChild(createConversationItem(tabTitle, conversation));
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
        
        if (Object.keys(conversationsByTabTitle).length === 0) {
            createNoConversationsMessage(statusEl);
            return;
        }

        const filteredConversations = Object.fromEntries(
            Object.entries(conversationsByTabTitle)
                .filter(([tabTitle]) => tabTitle !== 'Claude')
        );

        if (Object.keys(filteredConversations).length === 0) {
            const container = createStyledDiv(null, null);
            container.style.color = 'blue';
            container.appendChild(createBasicElement('strong', 'No downloadable conversations'));
            container.appendChild(createBasicElement('br'));
            container.appendChild(createBasicElement('span', 'All captured conversations are from the "Claude" tab.'));
            statusEl.appendChild(container);
            return;
        }

        if (Object.keys(filteredConversations).length > 1) {
            const header = createBasicElement('strong', 'Select a Conversation to Download:');
            statusEl.appendChild(header);
            statusEl.appendChild(createBasicElement('br'));
            
            Object.entries(filteredConversations).forEach(([tabTitle, conversation]) => {
                statusEl.appendChild(createDownloadOption(tabTitle, conversation));
            });
            
            document.querySelectorAll('.select-download').forEach(button => {
                button.addEventListener('click', function() {
                    const tabTitle = this.getAttribute('data-tab-title');
                    downloadConversation(tabTitle);
                });
            });
            return;
        }

        if (Object.keys(filteredConversations).length === 1) {
            const firstTabTitle = Object.keys(filteredConversations)[0];
            downloadConversation(firstTabTitle);
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

function downloadConversation(tabTitle) {
    if (tabTitle === 'Claude') {
        const statusEl = document.getElementById('status');
        clearElement(statusEl);
        
        const container = createStyledDiv(null, null);
        container.style.color = 'blue';
        container.appendChild(createBasicElement('strong', 'Download Prevented'));
        container.appendChild(createBasicElement('br'));
        container.appendChild(createBasicElement('span', 'Conversations from the "Claude" tab cannot be downloaded.'));
        statusEl.appendChild(container);
        return;
    }
    
    const conversation = conversationsByTabTitle[tabTitle];
    
    if (conversation) {
        const jsonString = JSON.stringify(conversation.data);
		  const html = generateHtml(jsonString);

        const blob = new Blob([html], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_conversations_${conversation.timestamp.replace(/:/g, '-')}_${encodeURIComponent(tabTitle)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        const statusEl = document.getElementById('status');
        clearElement(statusEl);
    }
}
