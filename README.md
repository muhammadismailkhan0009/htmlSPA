This is a javascript backend-agnostic library to allow developers to write HTML-based single page applications.
With this library, you do not need React, or Nextjs or any other javascript frameworks to develop single-page applications. Just use this library and the tags defined for it and you can easily build your SPA while staying in all-to-familiar HTML file.

The features of this library include(so far):
- framework agnostic: you can use any framework for backend as you desire.
- back and forth navigation of pages with routing
- javascript code fetch and caching only when needed(the concept of qwik framework)
- attributes that can be used inside HTML for different behaviors

Restrictions:
- if there is any event handler, it must be registered with library via "registerEventHandler(selector,event,listner)" method.
- the selector can be id, or attribute with its value to identify the element of the event handler. 

Following are the attributes developed so far(subject to change):
- data-spa-js("js_code_file_link"): fetches js from server, caches it, and executes it inside html only once
- data-spa-trigger("onHover"): add trigger for the request added in the tag
- data-spa-history-save: add in the tags which you want saved when you change routes. it doesn't save anything by default.
- data-spa-link(to be added in anchor tag): adds html replace feature for target element marked by tag "data-spa-target(target_id)"
- data-spa-component("component_name"): to announce a tag as component. can be accessed via query-selector in your custom js code as it is an attribute.
- data-spa-item("item_name"): to announce a tag as item of a component. can be accessed via query-selector in your custom code.

Some guidelines:
- You must save your auth info inside httponly cookies. this way, for every request, the auth info will be automatically added and you won't have to handle everything. Also, this works for page refresh or fetch the protected resoures directly in browser.

Suggestions are welcome in issues and discussions.
