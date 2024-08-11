// spa_framework.js

/**
 * TODO: add html replacing via target attribute just list htmx
 * !: indicate which values to store in globla storage(prmn) and which to store in window(temp)
 * 
 */
// Cache object to store fetched JavaScript files
const jsCache = new Map();

// Cache object to store fetched HTML content
const htmlCache = new Map();

function createElementFromTemplate(template) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = template.trim();
    return tempDiv.firstElementChild;
}

// Function to fetch HTML content
async function fetchHTML(url) {
    if (htmlCache.has(url)) {
        return htmlCache.get(url);
    }
    else {
        const htmlContent = await callFetchRequest(url);
        const htmlElement = createElementFromTemplate(htmlContent);
        htmlCache.set(url, htmlContent);//TODO: save this as element as well rather than raw html content
        if (htmlElement.hasAttribute('data-spa-component')) {
            htmlCache.set(htmlElement.getAttribute('data-spa-component'), htmlElement);
        }
        return htmlContent;
    }
}

async function callFetchRequest(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}`);
        }
        const htmlContent = await response.text();

        return htmlContent;
    } catch (error) {
        console.error(error);
        return null;
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
async function handleNavigation(url, targetId) {
    captureCurrentState();
    const htmlContent = await fetchHTMLContent(url);
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
async function fetchHTMLContent(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}`);
        }
        return await response.text();
    } catch (error) {
        console.error(error);
        return null;
    }
}





function replaceContent(htmlContent, targetId) {
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
        targetElement.innerHTML = getComponent(htmlContent);
    }
}

// TODO: in future make it so that the first element marked with data-spa-component becomes component and is used for data.
// after that component is selected, remove data-spa-component from all other elements in html. you'll need to do this proactively.
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
            const url = target.getAttribute('href');
            const targetId = target.getAttribute('data-spa-target');

            // Prevent default anchor behavior
            event.preventDefault();

            // Handle the navigation
            await handleNavigation(url, targetId);
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
            if (trigger === 'onHover') {
                element.addEventListener('mouseenter', handleTriggerEvent);
            } else if (trigger === 'onLoad') {
                handleTriggerEvent({ currentTarget: element });
            }
            else if (trigger === 'onClick') {
                element.addEventListener('click', handleTriggerEvent);
            }

            // Initialize forms with data-spa-post attribute
            else if (trigger === 'onSubmit') {
                element.addEventListener('submit', handleFormSubmit);
            }
        }

        // saves components so that can be retrieved for custom js
        if (element.hasAttribute('data-spa-component') && element.hasAttribute('data-spa-cache')) {
            const componentId = element.getAttribute('data-spa-component');
            if (!htmlCache.has(componentId)) {
                htmlCache.set(componentId, element);
            }

        }

    });
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
            // Search downwards within the children to find the first occurrence of the param
            targetElement = element.querySelector(`[data-spa-param="${searchParam}"]`);
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


function fetchElementValue(element) {
    if (!element) return null;

    // Fetch the value from the element based on its type
    if (element.value !== undefined) {
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

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params,
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

// TODO: consider this parent event trigger handler and write its childs with if-else logic
async function handleTriggerEvent(event) {
    const element = event.currentTarget;

    // js should be downloadable by default and must be added on each element addtition without event trigger
    if (element.hasAttribute('data-spa-get')) {
        handleGetRequest(element);
    }
    else if (element.hasAttribute('data-spa-post')) {
        await handleElementPostRequest(element);
    }


}

/**
 * TODO: for future, add support such as it can map json value to any level as intended with level as param
 */
async function handleElementPostRequest(element) {
    // Extract URL and response format from data-spa-post
    const [url, responseFormat] = element.getAttribute('data-spa-post').split(',');

    // Get parameters to send with the request
    const params = new URLSearchParams();
    const paramNames = element.getAttribute('data-spa-params').split(',');

    paramNames.forEach(paramName => {
        const paramValue = getParameterValue(paramName, element);
        if (paramValue) {
            params.append(paramName.replace(/^@dom:(up|down):/, ''), paramValue); // Append without the @dom: prefix
        }
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params,
        });

        if (!response.ok) {
            throw new Error(`Failed to submit request to ${url}`);
        }

        if (!element.hasAttribute('data-spa-target')) {
            // If the request was successful and no JSON response is expected, simply return
            return;
        }
        const jsonResponse = await response[responseFormat.trim()](); // Handle response format (json, text, etc.)

        // Update the output elements based on data-spa-target
        const targetMappings = element.getAttribute('data-spa-target')
            .replace(/{|}/g, '')  // Remove the curly braces
            .split(',');

        targetMappings.forEach(mapping => {
            const [jsonKey, spaItemKey] = mapping.split('->').map(item => item.trim());

            // Find all target elements recursively within the DOM using data-spa-item attribute
            const targetChildren = element.querySelectorAll(`[data-spa-item="${spaItemKey}"]`);

            // Iterate over all found elements at all levels and update their content
            targetChildren.forEach(targetChild => {
                if (jsonResponse[jsonKey] !== undefined) {
                    targetChild.textContent = jsonResponse[jsonKey];
                }
            });
        });



    } catch (error) {
        console.error(`Error submitting request: ${error}`);
    }
}


async function handleGetRequest(element) {
    const url = element.getAttribute('data-spa-get').split(',')[0];
    const targetId = element.getAttribute('data-spa-target');
    const swapMethod = element.getAttribute('data-spa-swap');
    const cache = element.hasAttribute('data-spa-cache');

    let htmlContent;
    if (cache) {
        htmlContent = await fetchHTML(url);

    } else {
        htmlContent = await callFetchRequest(url);
    }

    if (htmlContent && targetId && swapMethod) {
        const targetElement = document.querySelector(`[data-spa-item="${targetId}"]`);
        if (targetElement) {
            if (swapMethod === 'outerHTML') {
                targetElement.outerHTML = htmlContent;
            } else if (swapMethod === 'innerHTML') {
                targetElement.innerHTML = htmlContent;
            }

        }
    }
}

// Function to initialize the SPA framework
function initSPA() {
    // Find all elements with data-spa-js attribute
    // TODO: remove below block with data-spa-js and trigger

    const elements = document.querySelectorAll(':is([data-spa-js],[data-spa-trigger],[data-spa-component],[data-spa-post])');
    initializeElements(elements);

    loadAllScripts();
    interceptAnchorClicks();//TODO: remove this line and block as well

    // this allows to monitor DOM continuously for given selectors and run logic accordingly
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    const elements = node.parentElement.querySelectorAll(':is([data-spa-js],[data-spa-trigger],[data-spa-component],[data-spa-post])');
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

// Initialize the SPA framework on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initSPA();
});
