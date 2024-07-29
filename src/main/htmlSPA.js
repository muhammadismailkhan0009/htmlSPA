// spa_framework.js

/**
 * TODO: add event handling and re-initialization in library instead of html-tag based events.
 * 
 * 
 */
// Cache object to store fetched JavaScript files
const jsCache = new Map();

// it injects js to html instead of saving in library. this makes management and state persistence very easy
function injectJS(url) {
    const scriptElement = document.createElement('script');
    scriptElement.setAttribute('type', 'module');
    scriptElement.setAttribute('src', url);
    jsCache.set(url, `Script loaded successfully: ${url}`); // Add to cache once loaded
    document.body.appendChild(scriptElement);
}

// Function to handle mouseenter event
async function handleTriggerEvent(event) {
    const element = event.currentTarget;
    const jsUrl = element.getAttribute('data-spa-js');
    if (jsUrl && !jsCache.get(jsUrl)) {

        injectJS(jsUrl);
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

function initializeElements(elements) {
    elements.forEach(element => {
        const trigger = element.getAttribute('data-spa-trigger');
        if (trigger === 'onHover') {
            element.addEventListener('mouseenter', handleTriggerEvent);
        } else if (trigger === 'onLoad') {
            handleTriggerEvent({ currentTarget: element });
        }
    });
}
// Function to initialize the SPA framework
function initSPA() {
    // Find all elements with data-spa-js attribute
    const elements = document.querySelectorAll('[data-spa-js][data-spa-trigger]');
    initializeElements(elements);

    interceptAnchorClicks();

    // this allows to monitor DOM continuously for given selectors and run logic accordingly
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    const elements = node.querySelectorAll('[data-spa-js][data-spa-trigger]');
                    if (node.matches('[data-spa-js][data-spa-trigger]')) {
                        initializeElements([node]);
                    }
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

function initializeCustomEventHandlers() {
    customEventHandlers.forEach(({ selector, event, handler }) => {
        document.querySelectorAll(selector).forEach(element => {
            element.addEventListener(event, handler);
        });
    });
}

// Initialize the SPA framework on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initSPA();
});
