// spa_framework.js

/**
 * TODO: add html replacing via target attribute just list htmx
 * 
 * 
 */
// Cache object to store fetched JavaScript files
const jsCache = new Map();

// Cache object to store fetched HTML content
const htmlCache = new Map();

// Function to fetch HTML content
async function fetchHTML(url) {
    if (htmlCache.has(url)) {
        return htmlCache.get(url);
    }
    return callFetchRequest(url);

}

async function callFetchRequest(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}`);
        }
        const htmlContent = await response.text();
        htmlCache.set(url, htmlContent);
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

        const trigger = element.getAttribute('data-spa-trigger');
        if (trigger === 'onHover') {
            element.addEventListener('mouseenter', handleTriggerEvent);
        } else if (trigger === 'onLoad') {
            handleTriggerEvent({ currentTarget: element });
        }
        else if (trigger === 'onClick') {
            element.addEventListener('click', handleTriggerEvent);
        }
    });
}

// it injects js to html instead of saving in library. this makes management and state persistence very easy
function injectJS(url) {
    if (url && !jsCache.has(url)) {
        const scriptElement = document.createElement('script');
        scriptElement.setAttribute('type', 'module');
        scriptElement.setAttribute('src', url);
        scriptElement.setAttribute('async', '');
        jsCache.set(url, `Script loaded successfully: ${url}`); // Add to cache once loaded
        document.body.appendChild(scriptElement);
    }
}

// Scan for all data-spa-js attributes and inject script tags
function loadAllScripts() {
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
        htmlContent = callFetchRequest(url);
    }

    if (htmlContent) {
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
    const elements = document.querySelectorAll(':is([data-spa-js],[data-spa-trigger])');
    initializeElements(elements);

    loadAllScripts();
    interceptAnchorClicks();//TODO: remove this line and block as well

    // this allows to monitor DOM continuously for given selectors and run logic accordingly
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    const elements = node.parentElement.querySelectorAll(':is([data-spa-js],[data-spa-trigger])');
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

// TODO: if a component-marked object has been added into DOM, don't fetch its html again and again

// Initialize the SPA framework on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initSPA();
});
