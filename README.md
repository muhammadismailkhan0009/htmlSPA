This is a javascript backend-agnostic library to allow developers to write HTML-based single page applications.
With this library, you do not need React, or Nextjs or any other javascript frameworks to develop single-page applications. Just use this library and the tags defined for it and you can easily build your SPA while staying in all-to-familiar HTML file.

The features of this library include(so far):
- framework agnostic: you can use any framework for backend as you desire.
- back and forth navigation of pages with routing
- javascript code fetch and caching only when needed(the concept of qwik framework)
- attributes that can be used inside HTML for different behaviors

Note: for this library to work, you must add id attributes for all html tags in which you will be using these attributes.

Following are the attributes developed so far(subject to change):
- data-spa-js("js_code_file_link"): fetches js from server, caches it, and executes it inside html only once
- data-spa-trigger("onHover"): add trigger for the request added in the tag
- data-spa-history-save: add in the tags which you want saved when you change routes. it doesn't save anything by default.
- 

Suggestions are welcome in issues and discussions.