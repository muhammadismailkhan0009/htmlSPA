// spa_framework.js

/**
 * TODO: add html replacing via target attribute just list htmx
 * !: indicate which values to store in globla storage(prmn) and which to store in window(temp)
 * !: handle all form validation logic separately and specifically as its format type is not json or body
 * 
 */

// TODO: remove this caching store stuff and hanle caching on server side via headers. as browser provides support, no need to handle it manuall
// Cache object to store fetched JavaScript files
const jsCache = new Map();

// Cache object to store fetched HTML content
const htmlCache = new Map();

function createElementFromTemplate(template) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = template.trim();
    return tempDiv.firstElementChild;
}


async function callFetchRequest(url, method = 'GET', params = {}, customHeaders = {}, body = null) {
    // Default headers
    const defaultHeaders = {
        'X-SPA-Request': 'true',  // Custom header to detect if the request is from SPA library
    };

    // Combine default headers with custom headers, custom headers will overwrite default ones
    const headers = { ...defaultHeaders, ...customHeaders };

    // Build URL with query parameters for GET requests
    if (method === 'GET' && Object.keys(params).length > 0) {
        const urlParams = new URLSearchParams(params).toString();
        url += `?${urlParams}`;
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: headers,
            body: method === 'POST' ? JSON.stringify(body) : null
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        // Return the parsed JSON or text response based on Content-Type
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }

    } catch (error) {
        console.error(`Error during ${method} request to ${url}:`, error);
        throw error;
    }
}


window.addEventListener('popstate', async (event) => {
    const state = event.state;
    if (state) {
        revertComponents(state.content);
    }
    initializeCustomEventHandlers();
    // TODO: handle issue where state is null
});

function revertComponents(components) {
    Object.keys(components).forEach(id => {
        const targetElement = document.getElementById(id);
        if (targetElement) {
            targetElement.innerHTML = components[id];
        }
    });
}

// TODO:now, fix initial state on homepage such as on homepage, full page replace occurs rather than id replace as full page state is saved
async function handleNavigation(url, targetId, htmlContent) {
    captureCurrentState();
    if (htmlContent) {
        replaceContent(htmlContent, targetId);
        captureNextState(url);
        initializeCustomEventHandlers();
    }
}

function captureNextState(url) {
    const currentState = {
        content: getSavedComponents(),
        url: url
    };
    window.history.pushState(currentState, '', url);
}

function captureCurrentState() {
    const currentState = {
        content: getSavedComponents(),
        url: window.location.href
    };
    window.history.replaceState(currentState, '', currentState.url);
}

function replaceContent(htmlContent, targetId) {
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
        targetElement.innerHTML = htmlContent;
    }
}

// TODO: in future make it so that the first element marked with data-spa-component becomes component and is used for data.
// after that component is selected, remove data-spa-component from all other elements in html. you'll need to do this proactively.
//FIXME: i don't remember why i did even need this function?
function getComponent(htmlString) {
    // Create a DOM parser to parse the HTML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Find all elements with the data-spa-component attribute
    const elements = doc.querySelectorAll('[data-spa-component]');

    // Find the outermost element by comparing their positions in the DOM tree
    let outermostElement = null;
    elements.forEach(element => {
        if (!outermostElement || outermostElement.contains(element)) {
            outermostElement = element;
        }
    });

    console.log(outermostElement);
    return outermostElement.outerHTML;
}



function getSavedComponents() {
    const components = {};
    const elements = document.querySelectorAll('[data-spa-history-save]');
    elements.forEach(element => {
        // Only consider the outermost elements with the attribute
        if (!element.closest('[data-spa-history-save]') || element.closest('[data-spa-history-save]') === element) {
            components[element.id] = element.innerHTML;
        }
    });
    return components;
}

// TODO: one reason it may be needed is when handling resources like /profile and others. not needed for /login and /signup anymore
function interceptAnchorClicks() {
    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.tagName === 'A' && target.getAttribute('data-spa-link') != null) {
            // Prevent default anchor behavior
            event.preventDefault();

            // Handle the navigation
            await handleGetRequest(target);
        }
    });
}

// TODO: think of some way to manage things like popup by fetching html content from backend once and save on client side to avoid api calls

function initializeElements(elements) {
    elements.forEach(element => {
        if (element.hasAttribute('data-spa-js')) {
            injectJS(element.getAttribute('data-spa-js'));
        }

        if (element.hasAttribute('data-spa-trigger')) {
            const trigger = element.getAttribute('data-spa-trigger');
            const [eventType, selector] = parseTrigger(trigger);

            if (selector) {
                const triggeringElement = document.querySelector(selector);
                if (triggeringElement) {
                    triggeringElement.addEventListener(eventType, () => handleTriggerEvent({ currentTarget: element }));
                }
            } else if (eventType === 'onLoad') {
                handleTriggerEvent({ currentTarget: element });
            } else {
                element.addEventListener(eventType, handleTriggerEvent);
            }
        }

        // Saves components so that they can be retrieved for custom JS
        if (element.hasAttribute('data-spa-component') && element.hasAttribute('data-spa-cache')) {
            const componentId = element.getAttribute('data-spa-component');
            if (!htmlCache.has(componentId)) {
                htmlCache.set(componentId, element);
            }
        }
    });
}

// Parse the trigger to extract event type and optional selector
function parseTrigger(trigger) {
    const match = trigger.match(/(\w+)(\(([^)]+)\))?/); // Matches "event(selector)" or "event"
    if (match) {
        const eventType = match[1].toLowerCase();
        const selector = match[3] ? match[3].trim() : null;
        return [mapEventType(eventType), selector];
    }
    return [null, null];
}


// Map custom event types to standard DOM events
function mapEventType(eventType) {
    switch (eventType) {
        case 'onclick':
            return 'click';
        case 'onhover':
            return 'mouseenter';
        case 'onsubmit':
            return 'submit';
        case 'onload':
            return 'load';
        default:
            return eventType;
    }
}


function assignGlobalVariableValues(form) {
    const elementsWithVariable = form.querySelectorAll('[data-spa-variable]');
    elementsWithVariable.forEach(element => {
        const globalVarName = element.getAttribute('data-spa-variable');
        if (globalVarName && localStorage.getItem(globalVarName) !== undefined) {
            element.value = localStorage.getItem(globalVarName);
        }
    });
}

function getParameterValue(paramName, element) {
    if (paramName.startsWith('@dom:')) {
        const parts = paramName.replace('@dom:', '').split(':');
        const direction = parts[0]; // 'unique', 'up', or 'down'
        const searchParam = parts[1]; // The actual param attribute value to search for
        let targetElement = null;

        if (direction === 'unique') {
            // Search the whole document for the unique parameter
            targetElement = document.querySelector(`[data-spa-param="${searchParam}"]`);
        } else if (direction === 'up') {
            // Traverse upwards and across siblings to find the first occurrence of the param
            let currentElement = element;

            while (currentElement && !targetElement) {
                // Check the current element's siblings first
                targetElement = currentElement.parentElement
                    ? currentElement.parentElement.querySelector(`[data-spa-param="${searchParam}"]`)
                    : null;

                // If not found in siblings, move up to the parent
                currentElement = currentElement.parentElement;
            }
        } else if (direction === 'down') {
            // Traverse downwards, including all nested children, to find the first occurrence of the param
            targetElement = traverseDownwards(element, searchParam);
        }

        // Only fetch the value if targetElement is found
        if (targetElement) {
            return fetchElementValue(targetElement);
        }
    } else {
        // Fetch from LocalStorage
        return localStorage.getItem(paramName);
    }

    return null; // Return null if the value is not found
}

function traverseDownwards(element, searchParam) {
    // Check if the current element has the desired data-spa-param attribute
    if (element.getAttribute('data-spa-param') === searchParam) {
        return element;
    }

    // Recursively check all children
    for (let i = 0; i < element.children.length; i++) {
        // Recursively search through each child
        const found = traverseDownwards(element.children[i], searchParam);
        if (found) {
            return found;
        }
    }

    return null; // Return null if the element with the param was not found
}



function fetchElementValue(element) {
    if (!element) return null;

    if (element.tagName.toLowerCase() === 'meta') {
        return element.getAttribute('value');
    }
    // Fetch the value from the element based on its type
    else if (element.value !== undefined) {
        return element.value;
    } else if (element.textContent !== undefined) {
        return element.textContent;
    } else {
        return element.innerHTML;
    }
}





async function handleFormSubmit(event) {
    const form = event.currentTarget;

    // Check if the form is valid
    if (!form.reportValidity()) {
        return; // Form is not valid, so do nothing
    }

    event.preventDefault(); // Prevent default form submission

    assignGlobalVariableValues(form);
    const url = form.getAttribute('data-spa-post');
    const targetId = form.getAttribute('data-spa-target');

    const formData = new FormData(form);
    const params = new URLSearchParams();

    formData.forEach((value, key) => {
        params.append(key, value);
    });

    const headers = addCustomHeaders(form, 'data-spa-headers');

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params,
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Failed to submit form to ${url}`);
        }

        const htmlContent = await response.text();

        if (htmlContent) {
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.innerHTML = htmlContent;
            }
        }
    } catch (error) {
        console.error(`Error submitting form: ${error}`);
    }
}


// it injects js to html instead of saving in library. this makes management and state persistence very easy
async function injectJS(url) {
    if (url && !jsCache.has(url)) {
        const scriptElement = document.createElement('script');
        scriptElement.setAttribute('type', 'module');
        scriptElement.setAttribute('src', url);
        scriptElement.setAttribute('async', '');
        jsCache.set(url, `Script loaded successfully: ${url}`); // Add to cache once loaded
        document.head.appendChild(scriptElement);
    }
}

// Scan for all data-spa-js attributes and inject script tags
async function loadAllScripts() {
    const elements = document.querySelectorAll('[data-spa-js]');
    elements.forEach(element => {
        const jsUrl = element.getAttribute('data-spa-js');
        injectJS(jsUrl);
    });
}

// Update the name of the method to handleTriggerEvent
async function handleTriggerEvent(event) {
    const element = event.currentTarget;

    if (event.type == 'submit') {
        return handleFormSubmit(event);
    }
    await handleTriggerEventLogic(element);
}


async function getHierarchyFromTargetMappings(targetMappings){

}
async function handleTriggerEventLogic(element) {
    const targetMappings = element.getAttribute('data-spa-target');
    let responseFormat = null;

    if (element.getAttribute('data-spa-get') != null) {
        responseFormat = element.getAttribute('data-spa-get').split(',')[1];
    } else if (element.getAttribute('data-spa-post') != null) {
        responseFormat = element.getAttribute('data-spa-post').split(',')[1];
    }

    let mappingsExist = true;

    if (responseFormat === 'json') {
        /**
         * this is to verify the hierarchy of the components and mappings
         * so, fetch only component hierarchy from mappings such as for single mapping all hierarchy is defined in chain i.e.
         * [post-component.post-actions,.....]
         */
        const mappings = getHierarchyFromTargetMappings(targetMappings);

        // Function to check recursively if the component hierarchy exists
        function checkComponentHierarchy(componentKey, parentElement) {
            const componentElement = parentElement.querySelector(`[data-spa-component="${componentKey}"]`);
            if (componentElement) {
                return true;
            } else {
                const childNodes = Array.from(parentElement.childNodes).filter(node => node.nodeType === Node.ELEMENT_NODE);
                for (let i = 0; i < childNodes.length; i++) {
                    const found = checkComponentHierarchy(componentKey, childNodes[i]);
                    if (found) {
                        return true;
                    }
                }
            }
            return false;
        }

        // Check that all components in the mappings exist
        mappings.forEach(mapping => {
            if (mapping.includes(":")) {
                const componentKey = mapping.split(':')[0].trim();
                if (!checkComponentHierarchy(componentKey, element)) {
                    mappingsExist = false;
                }
            }
        });
    }

    // If the hierarchy does not exist, trigger fallback
    if (!mappingsExist && responseFormat === 'json') {
        await triggerFallback(element);
    } else {
        // Proceed with the normal get/post request
        if (element.hasAttribute('data-spa-get')) {
            await handleGetRequest(element);
        } else if (element.hasAttribute('data-spa-post')) {
            await handleElementPostRequest(element);
        }
    }
}




async function triggerFallback(element) {
    const fallbackUrl = element.getAttribute('data-spa-fallback-url');
    const targetId = element.getAttribute('data-spa-fallback-target');
    const swapStrategy = element.getAttribute('data-spa-fallback-swap');

    // Fetch fallback params and headers
    const fallbackParams = new URLSearchParams();
    const fallbackParamNames = element.getAttribute('data-spa-fallback-params') ? element.getAttribute('data-spa-fallback-params').split(',') : [];
    fallbackParamNames.forEach(paramName => {
        const paramValue = getParameterValue(paramName, element);
        if (paramValue) {
            fallbackParams.append(paramName.replace(/^@dom:(up|down):/, ''), paramValue);
        }
    });

    const fallbackHeaders = addCustomHeaders(element, 'data-spa-fallback-headers');

    // Make the fallback request
    let finalUrl = fallbackUrl;
    if (fallbackParams.toString()) {
        finalUrl += `?${fallbackParams.toString()}`;
    }

    try {
        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: fallbackHeaders
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch fallback content from ${fallbackUrl}`);
        }

        const htmlContent = await response.text();

        // Inject the fallback content into the specified target
        let targetElement = document.querySelector(targetId);
        if (targetElement) {
            // Detach the old element from the DOM before injecting new content
            const parentElement = targetElement.parentNode;
            if (swapStrategy === 'outerHTML') {
                // Fully replace the old element
                targetElement.removeEventListener('click', null, false);
                parentElement.removeChild(targetElement);
                const newElement = document.createElement('div');
                newElement.innerHTML = htmlContent.trim();
                // Attach the new element
                parentElement.insertAdjacentElement('afterbegin', newElement);

                targetElement = newElement;
                // Reinitialize event handlers for newly injected content
                initializeCustomEventHandlers();
            } else if (swapStrategy === 'innerHTML') {
                // Replace only the innerHTML of the target element
                targetElement.innerHTML = htmlContent;
                initializeCustomEventHandlers(); // Reinitialize event handlers for newly injected content
            }
        }

    } catch (error) {
        console.error(`Error during fallback: ${error}`);
    }
}

function getHeaderValue(paramOrValue) {
    if (paramOrValue.startsWith('@param:')) {
        const paramName = paramOrValue.replace('@param:', '').trim();
        const targetElement = document.querySelector(`[data-spa-param="${paramName}"]`);
        return targetElement ? fetchElementValue(targetElement) : null;
    } else if (paramOrValue.startsWith('@global:')) {
        const globalVarName = paramOrValue.replace('@global:', '').trim();
        return localStorage.getItem(globalVarName);  // Fetch the value from localStorage
    } else {
        return paramOrValue;  // Return the literal value
    }
}

function addCustomHeaders(element, headerAttribute) {
    const headers = {};
    const headerValues = element.getAttribute(headerAttribute);

    if (headerValues != null) {
        const headerMappings = JSON.parse(headerValues);

        Object.keys(headerMappings).forEach(headerName => {
            const paramName = headerMappings[headerName].trim();
            const headerValue = getHeaderValue(paramName);

            if (headerValue) {
                headers[headerName] = headerValue;
            }
        });
    }

    return headers;
}



/**
 * TODO: for future, add support such as it can map json value to any level as intended with level as param
 */
async function handleElementPostRequest(element) {
    // Extract URL and response format from data-spa-post
    const [url, responseFormat] = element.getAttribute('data-spa-post').split(',');

    // Get parameters to send with the request
    const params = new URLSearchParams();
    const paramNames = element.getAttribute('data-spa-params') ? element.getAttribute('data-spa-params').split(',') : [];

    paramNames.forEach(paramName => {
        const paramValue = getParameterValue(paramName, element);
        if (paramValue) {
            params.append(paramName.replace(/^@dom:(up|down):/, ''), paramValue); // Append without the @dom: prefix
        }
    });

    const headers = addCustomHeaders(element, 'data-spa-headers');

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params,
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Failed to submit request to ${url}`);
        }

        if (!element.hasAttribute('data-spa-target')) {
            // If the request was successful and no JSON response is expected, simply return
            return;
        }

        if (responseFormat === 'json') {
            const jsonResponse = await response.json();
            const targetMappings = element.getAttribute('data-spa-target').trim();

            // 1: Extract components while maintaining the hierarchy
            let extractedHtmlContent = '';
            const mappings = parseMappings(targetMappings);

            mappings.forEach(mapping => {
                if (mapping.includes(":")) {
                    const componentKey = mapping.split(':')[0].trim();
                    extractedHtmlContent += extractComponentHtml(componentKey, element);
                }
            });

            if (jsonResponse) {
                const populatedHtml = populateHtmlWithJson(extractedHtmlContent, jsonResponse, mappings);
                applyHtmlContent(element, populatedHtml, element.getAttribute('data-spa-swap'));
            }
        }
    } catch (error) {
        console.error(`Error submitting request: ${error}`);
    }
}

function extractComponentHtml(mappingKey, parentElement) {
    const componentElement = parentElement.querySelector(`[data-spa-component="${mappingKey}"]`);
    if (componentElement) {
        return componentElement.outerHTML;
    } else {
        const childNodes = Array.from(parentElement.childNodes).filter(node => node.nodeType === Node.ELEMENT_NODE);
        for (let i = 0; i < childNodes.length; i++) {
            const extractedHtml = extractComponentHtml(mappingKey, childNodes[i]);
            if (extractedHtml) {
                return extractedHtml;
            }
        }
    }
    return '';
}

function parseMappings(targetMappings) {
    return targetMappings
        .replace(/[\{\}\[\]]/g, '')  // Remove the curly and square braces
        .split(',')
        .map(mapping => mapping.trim());
}

function populateHtmlWithJson(htmlContent, jsonResponse, mappings) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    mappings.forEach(mapping => {
        const [jsonPath, spaPath] = mapping.split('->').map(item => item.trim());
        const jsonValue = getValueFromJsonPath(jsonResponse, jsonPath);

        if (Array.isArray(jsonValue)) {
            // Handle arrays
            const targetElement = doc.querySelector(`[data-spa-component="${spaPath.split('.')[0]}"]`);
            if (targetElement) {
                const parentElement = targetElement.parentElement;
                jsonValue.forEach(value => {
                    const clonedElement = targetElement.cloneNode(true);
                    populateHtmlWithJson(clonedElement.outerHTML, value, mappings); // Recursively populate
                    parentElement.appendChild(clonedElement);
                });
                parentElement.removeChild(targetElement); // Remove the template element
            }
        } else {
            // Handle single values
            const targetElement = doc.querySelector(`[data-spa-item="${spaPath.split('.').pop()}"]`) ||
                doc.querySelector(`[data-spa-param="${spaPath.split('.').pop()}"]`);
            if (targetElement) {
                if (targetElement.tagName.toLowerCase() === 'input' || targetElement.tagName.toLowerCase() === 'textarea') {
                    targetElement.value = jsonValue;
                } else {
                    targetElement.textContent = jsonValue;
                }
            }
        }
    });

    return doc.body.innerHTML;
}

function getValueFromJsonPath(jsonObject, path) {
    return path.split('.').reduce((acc, part) => {
        if (Array.isArray(acc)) {
            return acc.map(item => item[part]).filter(val => val !== undefined);
        }
        return acc && acc[part];
    }, jsonObject);
}

function applyHtmlContent(element, htmlContent, swapStrategy) {
    switch (swapStrategy) {
        case 'beforeend':
            element.insertAdjacentHTML('beforeend', htmlContent);
            break;
        case 'afterend':
            element.insertAdjacentHTML('afterend', htmlContent);
            break;
        case 'beforebegin':
            element.insertAdjacentHTML('beforebegin', htmlContent);
            break;
        case 'afterbegin':
            element.insertAdjacentHTML('afterbegin', htmlContent);
            break;
        case 'innerHTML':
        default:
            element.innerHTML = htmlContent;
            break;
    }
    initializeCustomEventHandlers();  // Reinitialize event handlers for newly injected content
}


async function handleGetRequest(element) {
    /**
     * TODO: handle get request with json body
     * 
     */
    const url = element.getAttribute('data-spa-get').split(',')[0];
    const targetId = element.getAttribute('data-spa-target');
    const swapMethod = element.getAttribute('data-spa-swap');
    const pushBoolean = element.getAttribute('data-spa-push-url');  // Get the push URL if provided

    // Handle data-spa-params
    const params = new URLSearchParams();
    const paramNames = element.getAttribute('data-spa-params') ? element.getAttribute('data-spa-params').split(',') : [];

    paramNames.forEach(paramName => {
        const paramValue = getParameterValue(paramName, element);
        if (paramValue) {
            params.append(paramName.replace(/^@dom:(up|down):/, ''), paramValue); // Append without the @dom: prefix
        }
    });

    let finalUrl = url;
    if (params.toString()) {
        finalUrl += `?${params.toString()}`;
    }

    const htmlContent = await callFetchRequest(finalUrl, "GET", params);

    if (htmlContent && targetId && swapMethod) {
        // TODO: handle data-spa-target for a pure id with #id format. the data-spa-item based logic is handled
        const targetElement = document.querySelector(`[data-spa-item="${targetId}"]`);
        if (targetElement) {
            if (pushBoolean) {
                handleNavigation(finalUrl, targetId, htmlContent);
            }
            else {
                if (swapMethod === 'outerHTML') {
                    targetElement.outerHTML = htmlContent;
                } else if (swapMethod === 'innerHTML') {
                    targetElement.innerHTML = htmlContent;
                }
            }


        }
    }
}


// Function to initialize the SPA framework
function initSPA() {
    // Find all elements with data-spa-js attribute
    // TODO: remove below block with data-spa-js and trigger

    const elements = document.querySelectorAll(':is([data-spa-js],[data-spa-trigger],[data-spa-component],[data-spa-post],[data-spa-get])');
    initializeElements(elements);

    loadAllScripts();
    interceptAnchorClicks();//TODO: remove this line and block as well

    // this allows to monitor DOM continuously for given selectors and run logic accordingly
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    const elements = node.parentElement.querySelectorAll(':is([data-spa-js],[data-spa-trigger],[data-spa-component],[data-spa-post],[data-spa-get])');
                    initializeElements(elements);
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initialize custom event handlers
    initializeCustomEventHandlers();
}

const customEventHandlers = [];

export function registerEventHandler(selector, event, handler) {
    customEventHandlers.push({ selector, event, handler });
    document.querySelectorAll(selector).forEach(element => {
        element.addEventListener(event, handler);
    });
}

export function getComponentToRenderFromCache(component_id) {
    return htmlCache.get(component_id);
}

function initializeCustomEventHandlers() {
    customEventHandlers.forEach(({ selector, event, handler }) => {
        document.querySelectorAll(selector).forEach(element => {
            element.addEventListener(event, handler);
        });
    });
}

// TODO: if a component-marked object has been added into DOM, don't fetch its html again and again

// function updateContentWithJsonMapping(element, jsonResponse) {
//     const targetMappings = element.getAttribute('data-spa-target')
//         .replace(/{|}/g, '')  // Remove the curly braces
//         .split(',');

//     targetMappings.forEach(mapping => {
//         const [jsonPath, targetPath] = mapping.split('->').map(item => item.trim());

//         // Get the JSON value based on the provided path (supports nested paths)
//         const jsonValue = getJsonValueFromPath(jsonResponse, jsonPath);

//         // Find all target elements recursively within the DOM using the provided path
//         const targetElement = getElementFromPath(element, targetPath);

//         if (Array.isArray(jsonValue)) {
//             // Handle array mapping by duplicating the target element
//             jsonValue.forEach(item => {
//                 const newElement = targetElement.cloneNode(true);
//                 populateElement(newElement, item, targetPath);
//                 targetElement.parentElement.appendChild(newElement);
//             });
//             targetElement.remove(); // Remove the template element
//         } else {
//             // Handle single object mapping
//             populateElement(targetElement, jsonValue, targetPath);
//         }
//     });
// }

function getJsonValueFromPath(json, path) {
    const keys = path.split('.');
    let value = json;

    for (let key of keys) {
        if (value && value.hasOwnProperty(key)) {
            value = value[key];
        } else {
            return null;
        }
    }

    return value;
}

function getElementFromPath(element, path) {
    const keys = path.split('.');
    let targetElement = element;

    for (let key of keys) {
        if (key.includes(':')) {
            // For array handling: split the key into element and index parts
            const [componentName, attribute] = key.split(':');
            targetElement = targetElement.querySelector(`[data-spa-item="${componentName}"]`);
            if (targetElement) {
                targetElement = targetElement.querySelector(`[data-spa-item="${attribute}"]`);
            }
        } else {
            // Regular mapping
            targetElement = targetElement.querySelector(`[data-spa-item="${key}"]`);
        }

        if (!targetElement) {
            return null;
        }
    }

    return targetElement;
}

function populateElement(element, value, path) {
    if (typeof value === 'object') {
        // Handle nested objects
        Object.keys(value).forEach(key => {
            const childPath = `${path}.${key}`;
            const childElement = getElementFromPath(element, childPath);

            if (childElement) {
                populateElement(childElement, value[key], childPath);
            }
        });
    } else {
        // Set the text content or value for the element
        if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
            element.value = value;
        } else {
            element.textContent = value;
        }
    }
}

// Initialize the SPA framework on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initSPA();
});
