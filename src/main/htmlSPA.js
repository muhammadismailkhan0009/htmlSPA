// spa_framework.js

// Cache object to store fetched JavaScript files
const jsCache = new Map();

// Function to fetch and cache JavaScript files
async function fetchAndCacheJS(url) {
    if (jsCache.get(url)) {
        console.log("exists");
        return jsCache.get(url);
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}`);
        }
        const jsContent = await response.text();
        console.log("fetching new data");
        jsCache.set(url, jsContent);
        return jsContent;
    } catch (error) {
        console.error(error);
        return null;
    }
}

// TODO: make sure that every type of js is executable
function executeJS(code) {
    try {
        const script = document.createElement('script');
        script.textContent = code;
        document.body.appendChild(script);
    } catch (error) {
        console.error('Failed to execute JavaScript:', error);
    }
}

// Function to handle mouseenter event
async function handleTriggerEvent(event) {
    const element = event.currentTarget;
    const jsUrl = element.getAttribute('data-spa-js');
    if (jsUrl && !jsCache.get(jsUrl)) {
        const jsCode = await fetchAndCacheJS(jsUrl);
        if (jsCode) {
            executeJS(jsCode);
        }
    }
}


window.addEventListener('popstate', async (event) => {
    const state = event.state;
    if (state) {
        revertComponents(state.content);
    } 
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

// TODO: make it so that the clicks events are not handled here, but in individual js file where they are necessary
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

    // Set up MutationObserver to handle dynamically added elements
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
}
// Initialize the SPA framework on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initSPA();
    // Capture the initial state

    // const initialState = {
    //     content: document.documentElement.outerHTML,
    //     url: window.location.href
    // };
    // window.history.replaceState(initialState, '', initialState.url);
});
