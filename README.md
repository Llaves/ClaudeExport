# Exporter for Claude.ai
Currently Claude.ai doesn't include a means for exporting a conversation. This add-on to Chrome and Firefox captures the JSON page content as it's downloaded, converts it to markdown, and downloads the result. 
The basic structure of the add-on was written using Claude. The conversion to markdown is largely copied from code written by Simon Willison and hosted on [ObservableHQ](https://observablehq.com/@simonw/convert-claude-json-to-markdown).

## Installation:
Firefox and Chrome have different requirements for extensions, so there are two implementations, each in a separate directory. 

To install in Firefox, download the claudeExport.xpi file to your computer. In the add-ons window, 
click the settings gear and then click "Install add-on from file". Browse to wherever you downloaded the .xpi file and select it.

To install in chrome, open the debugger interface by typing "chrome://extensions". In the upper right corner enable "Developer Mode". Then click "Load unpacked". Navigate to the Chrome folder and click on manifest.json.

## Use
Because the extenson captures the JSON as it's downloaded, if the extension is not active when the page was initially downloaded you will get a message "no conversation captured" when you try to view or download the captured conversations.
If this occurs, just reload the page and try again. 
