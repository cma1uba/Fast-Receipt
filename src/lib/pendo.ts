/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Define safe Pendo types
declare global {
  interface Window {
    pendo?: {
      initialize: (config: PendoConfig) => void;
      identify: (visitorId: string, traits?: Record<string, any>) => void;
      track: (eventName: string, metadata?: Record<string, any>) => void;
      updateOptions: (options: Record<string, any>) => void;
      _q?: any[];
    };
  }
}

interface PendoConfig {
  visitor: {
    id: string;
    email?: string;
    role?: string;
    [key: string]: any;
  };
  account: {
    id: string;
    name?: string;
    [key: string]: any;
  };
}

/**
 * Loads the Pendo Agent script dynamically.
 * By doing this in JS, we can dynamically boot it up when the user turns on the toggle or inputs a key.
 */
export function loadPendoScript(apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    // Already loaded?
    if (window.pendo && window.pendo.initialize) {
      resolve(true);
      return;
    }

    try {
      const win = window as any;
      const doc = document;
      const scriptTag = "script";
      const pendoName = "pendo";

      win[pendoName] = win[pendoName] || {};
      const o = win[pendoName];
      o._q = o._q || [];

      const methods = ["initialize", "identify", "updateOptions", "pageLoad", "track"];
      for (let i = 0; i < methods.length; i++) {
        const method = methods[i];
        o[method] = (function (m) {
          return function () {
            o._q[m === methods[0] ? "unshift" : "push"]([m].concat(Array.prototype.slice.call(arguments, 0)));
          };
        })(method);
      }

      // Check if tag already exists to avoid duplication
      const existingScript = doc.getElementById("pendo-analytics-script");
      if (existingScript) {
        resolve(true);
        return;
      }

      const scriptElement = doc.createElement(scriptTag);
      scriptElement.id = "pendo-analytics-script";
      scriptElement.async = true;
      scriptElement.src = `https://cdn.pendo.io/agent/static/${apiKey}/pendo.js`;

      scriptElement.onload = () => {
        console.log("🚀 Pendo Novus AI Analytics Agent loaded successfully.");
        resolve(true);
      };

      scriptElement.onerror = () => {
        console.error("❌ Failed to load Pendo Novus AI Analytics Agent script. Please check your API Key.");
        resolve(false);
      };

      const firstScript = doc.getElementsByTagName(scriptTag)[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(scriptElement, firstScript);
      } else {
        doc.head.appendChild(scriptElement);
      }
    } catch (e) {
      console.error("Error setting up Pendo dynamic script:", e);
      resolve(false);
    }
  });
}

/**
 * Initializes Pendo with the specified Visitor and Account information.
 */
export function initializePendo(apiKey: string, visitorId: string, email?: string, accountId?: string) {
  if (typeof window === "undefined") return;

  loadPendoScript(apiKey).then((success) => {
    if (!success || !window.pendo) return;

    const safeVisitorId = visitorId || "anonymous_user_" + Math.random().toString(36).substring(2, 9);
    const safeAccountId = accountId || "default_workspace";

    window.pendo.initialize({
      visitor: {
        id: safeVisitorId,
        email: email || `${safeVisitorId}@example.com`,
        integratedWith: "Novus AI",
        lastActive: new Date().toISOString(),
      },
      account: {
        id: safeAccountId,
        name: "Fast Receipt Parser Sandbox",
        ledgerCount: 1,
      },
    });

    console.log(`✨ Pendo Novus AI initialized for visitor "${safeVisitorId}" under account "${safeAccountId}".`);
  });
}

/**
 * Tracks a custom event in Pendo.
 */
export function trackPendoEvent(eventName: string, metadata?: Record<string, any>) {
  if (typeof window !== "undefined" && window.pendo && typeof window.pendo.track === "function") {
    window.pendo.track(eventName, metadata);
    console.log(`[Pendo Track] Event: "${eventName}"`, metadata);
  } else {
    // Elegant background fallback logging for development sandbox feedback
    console.debug(`[Pendo Offline Fallback] Managed track event "${eventName}"`, metadata);
  }
}

/**
 * Identifies or updates traits for the active visitor in Pendo.
 */
export function identifyPendoVisitor(visitorId: string, traits?: Record<string, any>) {
  if (typeof window !== "undefined" && window.pendo && typeof window.pendo.identify === "function") {
    window.pendo.identify(visitorId, traits);
    console.log(`[Pendo Identify] Visitor identified: "${visitorId}"`, traits);
  }
}
