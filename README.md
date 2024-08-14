# JavaScript Backend-Agnostic SPA Library

This is a JavaScript backend-agnostic library designed to enable developers to create HTML-based single-page applications (SPAs) effortlessly with hybrid approach. With this library, there is no need for React, Next.js, or any other JavaScript frameworks to develop SPAs. Simply use this library and its defined HTML attributes to build your SPA within a familiar HTML file structure.

## Features

- **Framework Agnostic**: Use any backend framework you prefer.
- **Routing**: Seamlessly navigate back and forth between pages with built-in routing support.
- **Lazy Loading and Caching**: Fetch and cache JavaScript code only when needed, inspired by the Qwik framework.
- **HTML Attributes for Behavior Control**: Utilize various attributes within your HTML to control behaviors and interactions.
- **State Persistence**: Automatically saves and restores the state of specified components during navigation.
- **Custom Event Handlers**: Allows the registration of custom event handlers.

## HTML Attributes

Here are the attributes developed so far (subject to change):

1. **`data-spa-js="js_code_file_link"`**: Fetches JavaScript from the server, caches it, and executes it inside HTML only once.
2. **`data-spa-trigger="onHover|onClick|onLoad"`**: Adds a trigger for the request defined in the tag.
3. **`data-spa-history-save`**: Use this attribute in tags to save their state when changing routes. By default, nothing is saved.
4. **`data-spa-link`**: To be added in anchor tags, enabling HTML replacement for the target element marked by the tag `data-spa-target="target_id"`.
5. **`data-spa-component="component_name"`**: Declares a tag as a component. This can be accessed via query selector in your custom JavaScript code.
6. **`data-spa-item="item_name"`**: Declares a tag as an item of a component. This can be accessed via query selector in your custom code.
7. **`data-spa-get="url,option"`**: Fetches HTML content from the server and replaces the content in the target element specified by `data-spa-target`. It supports caching with `data-spa-cache` and content swapping methods with `data-spa-swap`. For now, only "hypermedia" option is supported(will be removed later).
**`data-spa-post="url,option"`**: Fetches HTML content from the server and replaces the content in the target element specified by `data-spa-target`. It supports caching with `data-spa-cache` and content swapping methods with `data-spa-swap`. For now, only "json" option is supported(will be removed later).


## Restrictions

- **Event Handlers**: Event handlers must be registered with the library using the `registerEventHandler(selector, event, listener)` method. The selector can be an element ID or an attribute with its value to identify the element for the event handler.

## Guidelines

- **Authentication**: Save your authentication information inside HTTP-only cookies. This ensures that for every request, the authentication info is automatically included without manual handling. This approach also works for page refreshes or when directly accessing protected resources in the browser.

## Contributions

Suggestions and contributions are welcome. Please open issues or participate in discussions to share your ideas or improvements.

---

This library aims to simplify the development of SPAs by leveraging familiar HTML and minimal JavaScript, making it easier for developers to create powerful and dynamic web applications without the overhead of heavy frameworks.

